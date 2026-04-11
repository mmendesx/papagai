import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApiKeys1745000000000 implements MigrationInterface {
  name = 'AddApiKeys1745000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "api_keys" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "instance_id" integer REFERENCES "instances"("id") ON DELETE CASCADE,
        "name" varchar(255) NOT NULL,
        "prefix" varchar(16) NOT NULL,
        "key_hash" varchar(64) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "expires_at" timestamptz,
        "last_used_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_api_keys_key_hash" ON "api_keys" ("key_hash")`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_api_keys_user_id" ON "api_keys" ("user_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_api_keys_instance_id" ON "api_keys" ("instance_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_api_keys_instance_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_api_keys_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_api_keys_key_hash"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "api_keys"`);
  }
}
