import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ESM-compatible __dirname: when loaded via ts-node/esm, import.meta.url is available.
// When loaded via CommonJS ts-node, __dirname is available natively.
// The conditional below handles both execution contexts.
const currentDir: string =
  typeof __dirname !== 'undefined'
    ? __dirname
    : // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — import.meta.url is available at runtime in ESM context; tsc targets CommonJS for the build but this file is only loaded by the TypeORM CLI via ts-node/esm
      dirname(fileURLToPath(import.meta.url));

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'papagai',
  password: process.env.DB_PASS ?? 'papagai',
  database: process.env.DB_NAME ?? 'papagai',

  // Glob resolved from the location of this file — works regardless of CWD.
  entities: [join(currentDir, '**', '*.entity.ts')],
  migrations: [join(currentDir, 'migrations', '*.ts')],

  logging: false,
  synchronize: false,
});
