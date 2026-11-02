import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EXAMPLE_SECRETS = [
  'super_secret_jwt_key_academic_manager_2026',
  'super_secret_refresh_key_academic_manager_2026',
];

const envSchema = z
  .object({
    PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    MONGO_URI: z.string().default('mongodb://127.0.0.1:27018/smart_academic_manager?replicaSet=rs0&directConnection=true'),
    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
    JWT_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_SECRET: z.string().min(16, 'REFRESH_TOKEN_SECRET must be at least 16 characters long'),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
    CLIENT_URL: z.string().default('http://localhost:5173'),
  })
  .refine((data) => data.JWT_SECRET !== data.REFRESH_TOKEN_SECRET, {
    message: 'JWT_SECRET and REFRESH_TOKEN_SECRET must be distinct secrets',
    path: ['REFRESH_TOKEN_SECRET'],
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === 'production') {
        return (
          !EXAMPLE_SECRETS.includes(data.JWT_SECRET) &&
          !EXAMPLE_SECRETS.includes(data.REFRESH_TOKEN_SECRET)
        );
      }
      return true;
    },
    {
      message: 'Cannot use default or example secrets in production',
      path: ['JWT_SECRET'],
    }
  );

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables configuration:');
  console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export const ENV = parsedEnv.data;
