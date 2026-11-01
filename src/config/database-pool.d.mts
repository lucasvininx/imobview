import type { PoolConfig } from "pg";

export function databasePoolConfig(
  connectionString: string,
  certificate?: string,
): PoolConfig;
