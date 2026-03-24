import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3002),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MENU_SERVICE_URL: z.string().url(),
  RABBITMQ_URL: z.string().min(1),
  WRITE_DB_URL: z.string().min(1),
  READ_DB_URL: z.string().min(1),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid env: ${parsed.error.message}`);
  }
  return parsed.data;
}
