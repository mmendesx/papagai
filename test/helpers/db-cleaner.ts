type ResettablePrisma = {
  reset?: () => void;
  $executeRawUnsafe?: (query: string) => Promise<unknown>;
};

export async function truncateTables(prisma: ResettablePrisma): Promise<void> {
  if (typeof prisma.reset === 'function') {
    prisma.reset();
    return;
  }

  if (typeof prisma.$executeRawUnsafe !== 'function') {
    return;
  }

  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE instances RESTART IDENTITY CASCADE',
  );
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE users RESTART IDENTITY CASCADE',
  );
}
