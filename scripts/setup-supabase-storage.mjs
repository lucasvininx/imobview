import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
const env = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    SUPABASE_SECRET_KEY: z.string().min(20),
    SUPABASE_TOUR_BUCKET: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .default("imobview-tours"),
  })
  .parse(process.env);
const storage = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
).storage;
const options = {
  public: false,
  fileSizeLimit: 20971520,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
};
const existing = await storage.getBucket(env.SUPABASE_TOUR_BUCKET);
if (existing.error && existing.error.message !== "Bucket not found")
  throw new Error(
    "Não foi possível consultar o bucket. Confira a conexão e a chave do servidor.",
  );
const result = existing.data
  ? await storage.updateBucket(env.SUPABASE_TOUR_BUCKET, options)
  : await storage.createBucket(env.SUPABASE_TOUR_BUCKET, options);
if (result.error)
  throw new Error("Não foi possível configurar o bucket privado.");
process.stdout.write(
  "Bucket privado configurado com limite de 20 MB e formatos de imagem permitidos.\n",
);
