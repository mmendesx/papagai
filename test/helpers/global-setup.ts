import { execSync } from 'child_process';

/**
 * Jest globalSetup — runs once before any e2e test suite.
 * Applies all pending Prisma migrations against the test database.
 * DATABASE_URL must point to the test database before this runs.
 */
export default function globalSetup() {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env },
  });
}
