// CJS-compatible stub for the generated Prisma client.
// The generated client at src/generated/prisma/client.ts uses `import.meta.url`
// which cannot be parsed by ts-jest running in CJS mode. This stub is redirected
// to by the Jest moduleNameMapper so tests never load the real generated client.
// Runtime behaviour (PrismaClient constructor, queries) is always provided by
// per-test mocks of PrismaService — this file only needs to satisfy import shapes.

import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export class PrismaClient {}

export const Prisma = {
  PrismaClientKnownRequestError,
};
