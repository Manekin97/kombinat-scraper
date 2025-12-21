import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env.local in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}

const envSchema = z.object({
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_PHONE_NUMBER: z.string().min(1),
  TARGET_PHONE_NUMBER: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  KV_URL: z.string().url().optional(),
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().min(1).optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = envSchema.parse(process.env);

declare global {
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof envSchema> {}
  }
}
