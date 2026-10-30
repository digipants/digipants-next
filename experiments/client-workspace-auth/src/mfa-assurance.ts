import { createHmac, timingSafeEqual } from "node:crypto";
import { symmetricDecrypt } from "better-auth/crypto";
import { APIError } from "better-auth/api";
import type { SecretConfig } from "better-auth/crypto";
import { getAuthPrisma } from "./database.js";

type HookContext = {
  path: string;
  body?: unknown;
  context: {
    session: { session: unknown; user: { id: string } } | null;
    secretConfig: string | SecretConfig;
  };
};

type ReplayTransaction = {
  totpCodeUse: {
    createMany(input: { data: Array<{ userId: string; counter: bigint }>; skipDuplicates?: boolean }): Promise<unknown>;
  };
};

type ReplayDatabase = {
  twoFactor: { findFirst(input: { where: { userId: string } }): Promise<{ secret: string } | null> };
  $transaction<T>(operation: (tx: ReplayTransaction) => Promise<T>): Promise<T>;
};

const MFA_PATHS = new Set([
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
]);

function totpForCounter(secret: string, counter: bigint): string {
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", Buffer.from(secret, "utf8")).update(counterBytes).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary = ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

function matchingTotpCounters(secret: string, code: string, now = Date.now()): bigint[] {
  if (!/^\d{6}$/.test(code)) return [];
  const currentCounter = BigInt(Math.floor(now / 30_000));
  const matches: bigint[] = [];
  for (let offset = -1n; offset <= 1n; offset += 1n) {
    const counter = currentCounter + offset;
    if (counter < 0n) continue;
    const expected = Buffer.from(totpForCounter(secret, counter));
    const actual = Buffer.from(code);
    if (expected.length === actual.length && timingSafeEqual(expected, actual)) matches.push(counter);
  }
  return matches;
}

/**
 * Better Auth 1.7 does not persist a server-verifiable MFA assurance claim on
 * sessions. This local experiment adds one that only challenge verification
 * handlers can set, and atomically rejects a previously accepted TOTP step.
 */
export async function stampMfaAssurance(
  session: Record<string, unknown>,
  context: HookContext | null,
): Promise<{ data: Record<string, unknown> }> {
  const data: Record<string, unknown> = { ...session, mfaVerifiedAt: null };
  if (!context || !MFA_PATHS.has(context.path)) return { data };

  // An authenticated session calling a 2FA management endpoint is not a new
  // second-factor challenge. Better Auth exposes session=null during sign-in
  // challenges and a populated session during enrollment/management.
  if (context.context.session?.session) return { data };

  if (context.path === "/two-factor/verify-totp") {
    const userId = typeof session.userId === "string" ? session.userId : "";
    const code = (context.body as { code?: unknown } | undefined)?.code;
    if (!userId || typeof code !== "string") {
      throw APIError.from("UNAUTHORIZED", { message: "MFA verification required", code: "MFA_REQUIRED" });
    }

    const authDb = getAuthPrisma() as unknown as ReplayDatabase;
    const factor = await authDb.twoFactor.findFirst({ where: { userId } });
    if (!factor) throw APIError.from("UNAUTHORIZED", { message: "MFA verification required", code: "MFA_REQUIRED" });
    let secret = await symmetricDecrypt({ key: context.context.secretConfig, data: factor.secret });
    if (secret.startsWith("base32:")) {
      // Imported secrets are intentionally unsupported in this fixture until
      // an independently reviewed decoder and recovery lifecycle are added.
      throw APIError.from("UNAUTHORIZED", { message: "MFA verification required", code: "MFA_REQUIRED" });
    }
    const counters = matchingTotpCounters(secret, code);
    secret = "";
    if (counters.length === 0) {
      throw APIError.from("UNAUTHORIZED", { message: "MFA verification required", code: "MFA_REQUIRED" });
    }

    try {
      await authDb.$transaction(async (tx) => {
        await tx.totpCodeUse.createMany({
          data: counters.map((counter) => ({ userId, counter })),
          skipDuplicates: false,
        });
      });
    } catch {
      throw APIError.from("UNAUTHORIZED", { message: "MFA verification required", code: "MFA_REQUIRED" });
    }

    data.mfaVerifiedAt = new Date();
  } else {
    data.mfaVerifiedAt = new Date();
  }
  return { data };
}

export function isMfaVerificationPath(path: string): boolean {
  return MFA_PATHS.has(path);
}
