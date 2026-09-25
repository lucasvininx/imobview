-- Better Auth's database rate limiter creates rows without supplying an ID.
ALTER TABLE "RateLimit" ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text;
