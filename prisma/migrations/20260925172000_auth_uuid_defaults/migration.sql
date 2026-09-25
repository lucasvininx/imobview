-- generateId: "uuid" delegates IDs to PostgreSQL in the Prisma adapter.
ALTER TABLE "User" ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text;
ALTER TABLE "Session" ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text;
ALTER TABLE "Account" ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text;
ALTER TABLE "Verification" ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text;
