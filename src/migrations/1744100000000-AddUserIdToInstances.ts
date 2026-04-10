import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserIdToInstances1744100000000 implements MigrationInterface {
  name = 'AddUserIdToInstances1744100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // DESTRUCTIVE: clears all pre-tenancy rows — safe only before production launch
    await queryRunner.query(
      `TRUNCATE TABLE "instances" RESTART IDENTITY CASCADE`,
    );

    await queryRunner.query(
      `ALTER TABLE "instances" DROP CONSTRAINT "UQ_instances_name"`,
    );

    await queryRunner.query(`
      ALTER TABLE "instances"
        ADD COLUMN "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_instances_user_id" ON "instances" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_instances_user_name" ON "instances" ("user_id", "name")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Cannot restore truncated rows — down() only reverses schema changes from steps 2–5
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_instances_user_name"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_instances_user_id"`);

    await queryRunner.query(`ALTER TABLE "instances" DROP COLUMN "user_id"`);

    await queryRunner.query(`
      ALTER TABLE "instances"
        ADD CONSTRAINT "UQ_instances_name" UNIQUE ("name")
    `);
  }
}
