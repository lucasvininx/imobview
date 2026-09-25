import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { readEnv } from "@/config/env";

const globalDb = globalThis as unknown as { database?: PrismaClient };
export const db =
  globalDb.database ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: readEnv().DATABASE_URL }),
  });
if (process.env.NODE_ENV !== "production") globalDb.database = db;
