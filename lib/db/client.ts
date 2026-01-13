/**
 * Prisma Database Client
 *
 * Singleton pattern for Prisma client to avoid too many connections in serverless.
 * Uses global object in development to survive HMR.
 *
 * Usage:
 *   import { prisma } from '@/lib/db/client';
 *   const users = await prisma.user.findMany();
 */

import { PrismaClient } from '@prisma/client';

// Declare global type for TypeScript
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Prisma client options
const prismaClientOptions = {
  log:
    process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn'] as ('query' | 'error' | 'warn')[]
      : ['error'] as ('error')[],
};

// Use existing client in development (survives HMR)
// Create new client in production (serverless - new instance per request is fine)
export const prisma = globalThis.prisma ?? new PrismaClient(prismaClientOptions);

// In development, preserve client across HMR
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
