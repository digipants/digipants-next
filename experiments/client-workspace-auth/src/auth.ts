import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { twoFactor } from "better-auth/plugins";
import { getAuthPrisma, getWorkspacePrisma } from "./database.js";
import { INVITATION_HEADER, redeemClientInvitation } from "./invitations.js";
import { consumeSyntheticMailboxChallenge, findPendingInvitationIdForBearer } from "./mailbox-proof.js";
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
          // Better Auth calls this hook before its adapter assigns a user id.
          // Choose the server-owned subject here and pass the same value to
          // both the workspace principal and Better Auth's subsequent insert.
          const providerSubject = randomUUID();
          const token = context.headers?.get(INVITATION_HEADER) ?? "";
          const challengeId = context.headers?.get("x-digipants-mail-challenge-id") ?? "";
          const challengeCode = context.headers?.get("x-digipants-mail-proof") ?? "";
          const workspaceDb = getWorkspacePrisma();
          const invitationId = await findPendingInvitationIdForBearer({
            workspaceDb, token, intendedEmail: user.email,
          });
          if (!invitationId || !(await consumeSyntheticMailboxChallenge({
            workspaceDb, authDb: getAuthPrisma(), invitationId,
            intendedEmail: user.email, challengeId, code: challengeCode,
          }))) {
            throw APIError.from("UNAUTHORIZED", {
              message: "Invitation required", code: "INVITATION_REQUIRED",
            });
          }
          // Separate DB transactions: if this or the provider identity insert
          // fails, the one-time proof remains consumed. That is fail-closed;
          // controlled reconciliation and reissuance are future launch gates.
          const accepted = await redeemClientInvitation({
            workspaceDb, token, intendedEmail: user.email, providerSubject,
          });
          if (!accepted) {
            throw APIError.from("UNAUTHORIZED", { message: "Invitation required", code: "INVITATION_REQUIRED" });
          }
          return { data: { id: providerSubject } };
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
