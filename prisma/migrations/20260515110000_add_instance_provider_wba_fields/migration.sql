BEGIN;

DO $$ BEGIN
  CREATE TYPE "InstanceProvider" AS ENUM ('web', 'wba');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "instances"
  ADD COLUMN IF NOT EXISTS "provider" "InstanceProvider" NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS "wba_phone_number_id" varchar(64),
  ADD COLUMN IF NOT EXISTS "wba_business_account_id" varchar(64),
  ADD COLUMN IF NOT EXISTS "wba_display_phone_number" varchar(128),
  ADD COLUMN IF NOT EXISTS "wba_access_token_encrypted" text,
  ADD COLUMN IF NOT EXISTS "wba_app_secret_encrypted" text,
  ADD COLUMN IF NOT EXISTS "wba_webhook_verify_token_encrypted" text,
  ADD COLUMN IF NOT EXISTS "wba_webhook_configured_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "wba_last_health_check_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "wba_last_health_check_status" varchar(32);

UPDATE "instances"
SET "provider" = 'web'
WHERE "provider" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_instances_provider" ON "instances" ("provider");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_instances_wba_phone_number_id_unique"
  ON "instances" ("wba_phone_number_id")
  WHERE "wba_phone_number_id" IS NOT NULL;

COMMIT;
