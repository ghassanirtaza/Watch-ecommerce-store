import { PrismaClient } from "@prisma/client";

// Singleton pattern — required so Next.js dev-mode hot reload doesn't
// spawn a new PrismaClient (and new DB connections) on every file save.
// In production, DATABASE_URL must point at a pooled connection
// (PgBouncer / Prisma Accelerate) — see docs/AI_CONTEXT.md.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
