import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { twoFactor } from "better-auth/plugins";
import { getAuthPrisma } from "./database.js";
import { INVITATION_HEADER } from "./invitations.js";
import { beginFounderBootstrap, completeFounderBootstrap } from "./founder-bootstrap.js";
import {
  consumeMailboxProofForEnrollment,
  markAuthIdentityCreated,
  prepareEnrollmentAttempt,
  reconcileEnrollmentAttempt,
} from "./enrollment-saga.js";
import { stampMfaAssurance } from "./mfa-assurance.js";
import { workspaceOrigin, workspaceRuntimeMode } from "./workspace-runtime.js";

const runtimeMode = workspaceRuntimeMode();
const origin = workspaceOrigin();
const secret = runtimeMode === "production"
  ? process.env.PRODUCTION_BETTER_AUTH_SECRET
  : process.env.BETTER_AUTH_SECRET;
if (!secret || Buffer.byteLength(secret) < 32) {
  throw new Error("Client Workspace authentication requires a 256-bit-or-stronger server secret.");
}
if (!origin || runtimeMode === "disabled") {
  throw new Error("Client Workspace authentication is disabled in this deployment context.");
}

const baseURL = runtimeMode === "production"
  ? process.env.PRODUCTION_AUTH_BASE_URL
  : runtimeMode === "protected-staging"
    ? process.env.AUTH_BASE_URL
    : (process.env.AUTH_BASE_URL ?? `${origin}/api/auth`);
if (baseURL !== `${origin}/api/auth`) {
  throw new Error("The environment-specific Better Auth base URL must exactly match the enabled workspace origin.");
}

const disabledPaths = [
  "/sign-in/social",
  "/sign-in/magic-link",
  "/sign-in/email-otp",
  "/sign-in/phone-number",
  "/sign-in/username",
  "/sign-in/passkey",
  "/sign-up/anonymous",
  "/sign-in/anonymous",
  "/two-factor/send-otp",
  "/two-factor/verify-otp",
];
const FOUNDER_CHALLENGE_HEADER = "x-digipants-founder-bootstrap-challenge-id";
const FOUNDER_PROOF_HEADER = "x-digipants-founder-mail-proof";

export const auth = betterAuth({
  appName: "DigiPants Client Workspace",
  baseURL,
  trustedOrigins: [origin],
  secret,
  telemetry: { enabled: false },
  database: prismaAdapter(getAuthPrisma(), { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
    minPasswordLength: 12,
  },
  disabledPaths,
  user: {
    modelName: "user",
  },
  session: {
    modelName: "session",
    expiresIn: 60 * 60 * 12,
    updateAge: 60 * 60,
    additionalFields: {
      mfaVerifiedAt: {
        type: "date",
        required: false,
        input: false,
        returned: false,
      },
    },
  },
  advanced: {
    useSecureCookies: runtimeMode !== "local-test",
    // Next/Netlify routes use trailingSlash=true for API paths. Match both
    // forms so Better Auth recognizes `/sign-up/email/` as `/sign-up/email`.
    skipTrailingSlashes: true,
    database: {
      generateId: () => randomUUID(),
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, context) => {
          if (!context || context.path !== "/sign-up/email" || context.method !== "POST") {
            throw APIError.from("UNAUTHORIZED", { message: "Invitation required", code: "INVITATION_REQUIRED" });
          }
          const hasFounderChallenge = context.headers?.has(FOUNDER_CHALLENGE_HEADER) ?? false;
          const hasFounderProof = context.headers?.has(FOUNDER_PROOF_HEADER) ?? false;
          const founderChallengeId = context.headers?.get(FOUNDER_CHALLENGE_HEADER);
          const founderProof = context.headers?.get(FOUNDER_PROOF_HEADER);
          if (hasFounderChallenge || hasFounderProof) {
            if (!founderChallengeId || !founderProof) {
              throw APIError.from("UNAUTHORIZED", { message: "Invitation required", code: "INVITATION_REQUIRED" });
            }
            const subject = await beginFounderBootstrap({
              workspaceDb: (await import("./database.js")).getWorkspacePrisma(),
              authDb: getAuthPrisma(),
              email: user.email,
              challengeId: founderChallengeId,
              code: founderProof,
            });
            if (!subject) {
              throw APIError.from("UNAUTHORIZED", { message: "Invitation required", code: "INVITATION_REQUIRED" });
            }
            return { data: { id: subject, emailVerified: true } };
          }
          const token = context.headers?.get(INVITATION_HEADER) ?? "";
          const challengeId = context.headers?.get("x-digipants-mail-challenge-id") ?? "";
          const challengeCode = context.headers?.get("x-digipants-mail-proof") ?? "";
          const attempt = await prepareEnrollmentAttempt({
            token, intendedEmail: user.email, challengeId,
          });
          if (!attempt || attempt.state !== "pending") {
            throw APIError.from("UNAUTHORIZED", {
              message: "Invitation required", code: "INVITATION_REQUIRED",
            });
          }
          const reconciled = await reconcileEnrollmentAttempt(attempt.id);
          if (reconciled && reconciled !== "pending") {
            throw APIError.from("UNAUTHORIZED", { message: "Invitation required", code: "INVITATION_REQUIRED" });
          }
          if (!(await consumeMailboxProofForEnrollment({
            attemptId: attempt.id, challengeId, code: challengeCode,
          }))) {
            throw APIError.from("UNAUTHORIZED", { message: "Invitation required", code: "INVITATION_REQUIRED" });
          }
          // Better Auth's own user insert is the next, separate database
          // commit. The stable subject is journaled before this insert so a
          // crash can be reconciled without creating a different identity.
          return { data: { id: attempt.providerSubject, emailVerified: true } };
        },
        after: async (user, context) => {
          if (context?.headers?.has(FOUNDER_CHALLENGE_HEADER) ||
              context?.headers?.has(FOUNDER_PROOF_HEADER)) {
            const completed = await completeFounderBootstrap({
              workspaceDb: (await import("./database.js")).getWorkspacePrisma(),
              email: user.email,
              providerSubject: user.id,
            });
            if (!completed) {
              throw APIError.from("UNAUTHORIZED", {
                message: "Founder enrollment requires repair", code: "FOUNDER_ENROLLMENT_REPAIR_REQUIRED",
              });
            }
            return;
          }
          const state = await markAuthIdentityCreated(user.id, user.email);
          if (state !== "grant_ready_for_review" && state !== "completed") {
            throw APIError.from("UNAUTHORIZED", { message: "Enrollment requires repair", code: "ENROLLMENT_REPAIR_REQUIRED" });
          }
        },
      },
    },
    session: {
      create: {
        before: stampMfaAssurance,
      },
    },
  },
  plugins: [
    twoFactor({
      issuer: "DigiPants",
      skipVerificationOnEnable: false,
      trustDeviceMaxAge: 0,
      accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 60 },
    }),
  ],
});
