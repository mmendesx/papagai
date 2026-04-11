import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApiKeyPermissions1745100000000 implements MigrationInterface {
  name = 'AddApiKeyPermissions1745100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "api_keys" ADD COLUMN "permissions" text[]`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "permissions"`,
    );
  }
}
