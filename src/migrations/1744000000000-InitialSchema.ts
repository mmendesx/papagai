import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1744000000000 implements MigrationInterface {
  name = 'InitialSchema1744000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"            uuid          NOT NULL DEFAULT gen_random_uuid(),
        "name"          varchar(255)  NOT NULL,
        "email"         varchar(255)  NOT NULL,
        "password_hash" varchar(255)  NOT NULL,
        "created_at"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
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
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "instances"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
