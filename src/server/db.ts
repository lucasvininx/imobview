import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { readEnv } from "@/config/env";
import { databasePoolConfig } from "@/config/database";

const globalDb = globalThis as unknown as { database?: PrismaClient };
const env = readEnv();
export const db =
  globalDb.database ??
  new PrismaClient({
    adapter: new PrismaPg(
      databasePoolConfig(env.DATABASE_URL, env.DATABASE_CA_CERT),
    ),
  });
if (process.env.NODE_ENV !== "production") globalDb.database = db;
