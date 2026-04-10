import { DataSource } from 'typeorm';
import { join } from 'path';

/**
 * Jest globalSetup — runs once before any e2e test suite.
 * Creates the papagai_test schema by applying all pending migrations.
 * Uses the same DataSource config as src/typeorm.datasource.ts but targets papagai_test.
 */
export default async function globalSetup() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USER ?? 'papagai',
    password: process.env.DB_PASS ?? 'papagai',
    database: process.env.DB_NAME ?? 'papagai_test',
    entities: [join(__dirname, '../../src/**/*.entity.ts')],
    migrations: [join(__dirname, '../../src/migrations/*.ts')],
    logging: false,
    synchronize: false,
  });

  await ds.initialize();
  await ds.runMigrations({ transaction: 'each' });
  await ds.destroy();
}
