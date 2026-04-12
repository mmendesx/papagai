-- Prisma baseline migration: consolidates 4 TypeORM migrations
-- This migration was already applied — do not run against existing databases.
-- To mark as applied: prisma migrate resolve --applied 0_init

BEGIN;

-- Migration 1: InitialSchema1744000000000

CREATE TABLE "users" (
  "id"            uuid          NOT NULL DEFAULT gen_random_uuid(),
  "name"          varchar(255)  NOT NULL,
  "email"         varchar(255)  NOT NULL,
  "password_hash" varchar(255)  NOT NULL,
  "created_at"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_users_email" UNIQUE ("email"),
  CONSTRAINT "PK_users" PRIMARY KEY ("id")
);

CREATE TABLE "instances" (
  "id"              SERIAL        NOT NULL,
  "name"            varchar       NOT NULL,
  "webhook_url"     varchar(2048),
  "webhook_headers" jsonb         NOT NULL DEFAULT '{}',
  "webhook_enabled" boolean       NOT NULL DEFAULT false,
  "webhook_events"  text[]        NOT NULL DEFAULT ARRAY['message','message_update','qr','connected','disconnected'],
  "created_at"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_instances_name" UNIQUE ("name"),
  CONSTRAINT "PK_instances" PRIMARY KEY ("id")
);

-- Migration 2: AddUserIdToInstances1744100000000

TRUNCATE TABLE "instances" RESTART IDENTITY CASCADE;

ALTER TABLE "instances" DROP CONSTRAINT "UQ_instances_name";

ALTER TABLE "instances"
  ADD COLUMN "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE;

CREATE INDEX "idx_instances_user_id" ON "instances" ("user_id");

CREATE UNIQUE INDEX "idx_instances_user_name" ON "instances" ("user_id", "name");

-- Migration 3: AddApiKeys1745000000000

CREATE TABLE "api_keys" (
  "id"          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id"     uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "instance_id" integer REFERENCES "instances"("id") ON DELETE CASCADE,
  "name"        varchar(255) NOT NULL,
  "prefix"      varchar(16) NOT NULL,
  "key_hash"    varchar(64) NOT NULL,
  "enabled"     boolean NOT NULL DEFAULT true,
  "expires_at"  timestamptz,
  "last_used_at" timestamptz,
  "created_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "idx_api_keys_key_hash" ON "api_keys" ("key_hash");

CREATE INDEX "idx_api_keys_user_id" ON "api_keys" ("user_id");

CREATE INDEX "idx_api_keys_instance_id" ON "api_keys" ("instance_id");

-- Migration 4: AddApiKeyPermissions1745100000000

ALTER TABLE "api_keys" ADD COLUMN "permissions" text[] NOT NULL DEFAULT ARRAY[]::text[];
UPDATE "api_keys" SET "permissions" = ARRAY[]::text[] WHERE "permissions" IS NULL;

COMMIT;
