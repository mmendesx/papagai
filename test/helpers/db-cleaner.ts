import { DataSource } from 'typeorm';

export async function truncateTables(dataSource: DataSource): Promise<void> {
  await dataSource.query('TRUNCATE TABLE instances RESTART IDENTITY CASCADE');
  await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
}
