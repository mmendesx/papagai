/** Dev-only default; production bootstrap rejects this value. */
export const DEV_JWT_SECRET_PLACEHOLDER = 'papagai-dev-jwt-secret';

export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mediaDir: process.env.MEDIA_DIR || './media',
  instancesDir: process.env.INSTANCES_DIR || './instances',
  defaultWebhook: process.env.DEFAULT_WEBHOOK || null,
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE ?? `${50 * 1024 * 1024}`, 10),
  maxInstances: parseInt(process.env.MAX_INSTANCES ?? '10', 10),
  logLevel: process.env.LOG_LEVEL || 'debug',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  appKey: process.env.APP_KEY ?? '',
  jwtSecret: process.env.JWT_SECRET ?? DEV_JWT_SECRET_PLACEHOLDER,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  webhookAllowPrivateHosts:
    process.env.WEBHOOK_ALLOW_PRIVATE_HOSTS === 'true' &&
    process.env.NODE_ENV === 'development',
  authThrottleTtl: parseInt(process.env.AUTH_THROTTLE_TTL ?? '60', 10),
  authThrottleLimit: parseInt(process.env.AUTH_THROTTLE_LIMIT ?? '5', 10),
  // These individual DB_* vars are used by docker-compose health-checks and any
  // non-Prisma tooling.  Prisma itself reads DATABASE_URL directly from the
  // environment; pool parameters (connection_limit, pool_timeout, socket_timeout)
  // must be appended to that URL as query params — see .env.example.
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER || 'papagai',
    pass: process.env.DB_PASS || 'papagai',
    name: process.env.DB_NAME || 'papagai',
  },
});
