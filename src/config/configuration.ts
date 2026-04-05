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
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER || 'papagai',
    pass: process.env.DB_PASS || 'papagai',
    name: process.env.DB_NAME || 'papagai',
  },
});
