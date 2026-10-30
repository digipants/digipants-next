import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { twoFactor } from "better-auth/plugins";
import { getAuthPrisma } from "./database.js";
import { INVITATION_HEADER } from "./invitations.js";
import {
  consumeMailboxProofForEnrollment,
  markAuthIdentityCreated,
  prepareEnrollmentAttempt,
  reconcileEnrollmentAttempt,
} from "./enrollment-saga.js";
import { stampMfaAssurance } from "./mfa-assurance.js";

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32) {
  throw new Error("Set a synthetic BETTER_AUTH_SECRET of at least 32 characters for this local experiment.");
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

export const auth = betterAuth({
  appName: "DigiPants Client Workspace Security Experiment",
  baseURL: process.env.AUTH_BASE_URL ?? "http://localhost:3000/api/auth",
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
          return { data: { id: attempt.providerSubject } };
        },
        after: async (user) => {
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
