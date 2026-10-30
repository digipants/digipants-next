CREATE SCHEMA IF NOT EXISTS "auth_spike";

CREATE TABLE "auth_spike"."user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "two_factor_enabled" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_spike"."session" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "mfa_verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_spike"."account" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMPTZ(6),
    "refresh_token_expires_at" TIMESTAMPTZ(6),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_spike"."verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_spike"."twoFactor" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backup_codes" TEXT NOT NULL,
    "verified" BOOLEAN DEFAULT true,
    "failed_verification_count" INTEGER DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    CONSTRAINT "twoFactor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_spike"."totp_code_use" (
    "user_id" TEXT NOT NULL,
    "counter" BIGINT NOT NULL,
    "used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "totp_code_use_pkey" PRIMARY KEY ("user_id", "counter")
);

CREATE UNIQUE INDEX "user_email_key" ON "auth_spike"."user"("email");
CREATE UNIQUE INDEX "session_token_key" ON "auth_spike"."session"("token");
CREATE INDEX "auth_spike_session_user_id_idx" ON "auth_spike"."session"("user_id");
CREATE INDEX "auth_spike_account_user_id_idx" ON "auth_spike"."account"("user_id");
CREATE INDEX "auth_spike_verification_identifier_idx" ON "auth_spike"."verification"("identifier");
CREATE INDEX "auth_spike_two_factor_secret_idx" ON "auth_spike"."twoFactor"("secret");
CREATE INDEX "auth_spike_two_factor_user_id_idx" ON "auth_spike"."twoFactor"("user_id");

ALTER TABLE "auth_spike"."session"
  ADD CONSTRAINT "session_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "auth_spike"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth_spike"."account"
  ADD CONSTRAINT "account_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "auth_spike"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth_spike"."twoFactor"
  ADD CONSTRAINT "twoFactor_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "auth_spike"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth_spike"."totp_code_use"
  ADD CONSTRAINT "totp_code_use_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "auth_spike"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
