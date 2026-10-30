import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32) throw new Error("Set a synthetic local Better Auth secret before schema generation.");

export const auth = betterAuth({
  appName: "DigiPants Client Workspace Security Experiment",
  baseURL: process.env.AUTH_BASE_URL ?? "http://localhost:3000/api/auth",
  secret,
  telemetry: { enabled: false },
  emailAndPassword: { enabled: true },
  session: {
    additionalFields: {
      mfaVerifiedAt: { type: "date", required: false, input: false, returned: false },
    },
  },
  plugins: [twoFactor({ issuer: "DigiPants", skipVerificationOnEnable: false })],
});
