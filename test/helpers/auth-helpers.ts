import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';

interface RegisterLoginResult {
  token: string;
  userId: string;
}

export async function registerAndLogin(
  app: INestApplication,
  opts: { email?: string; password?: string; name?: string } = {},
): Promise<RegisterLoginResult> {
  const email = opts.email ?? `user_${Date.now()}@e2e.test`;
  const password = opts.password ?? 'password123';
  const name = opts.name ?? 'Test User';

  const regRes = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ name, email, password, appKey: 'ci-app-key' });

  const loginRes = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password });

  return {
    token: loginRes.body.accessToken,
    userId: regRes.body.user?.id,
  };
}
