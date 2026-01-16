import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Prevent connection exhaustion in serverless environment
export const prisma = globalForPrisma.prisma || new PrismaClient({
    log: ['error', 'warn'], // Reduce log verbosity from Prisma too
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
