import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const csv = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().default(3000),
    DATABASE_URL: z.string().min(1),
    /** Browser origins allowed by CORS and accepted as the Clerk token's `azp`. */
    CORS_ORIGINS: csv,
    /** Clerk backend secret. Required outside tests. */
    CLERK_SECRET_KEY: z.string().optional(),
    /** PEM public key for networkless token verification (Clerk dashboard → API keys). Optional. */
    CLERK_JWT_KEY: z.string().optional(),
    /** Public URL of the web app (invite links point at `${WEB_URL}/sign-up`). Placeholder until domains are chosen. */
    WEB_URL: z.url().default('http://localhost:3001'),
    /** Sender for all emails, e.g. "TruHost <no-reply@truhost.example>". */
    EMAIL_FROM: z.string().min(3).default('TruHost <no-reply@truhost.example>'),
    /** Resend API key. When unset outside production, emails are logged instead of sent. */
    RESEND_API_KEY: z.string().optional(),
    TAX_FIELDS_ENABLED: bool,
    /** Multiplies every rate limit; tests raise it so only the dedicated throttling test trips limits. */
    RATE_LIMIT_MULTIPLIER: z.coerce.number().positive().default(1),
    /** Serve Swagger UI at /v1/docs. Defaults to on outside production. */
    OPENAPI_UI: z.enum(['true', 'false']).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'test' && !env.CLERK_SECRET_KEY) {
      ctx.addIssue({ code: 'custom', path: ['CLERK_SECRET_KEY'], message: 'Required' });
    }
    if (env.NODE_ENV === 'production' && !env.RESEND_API_KEY) {
      ctx.addIssue({ code: 'custom', path: ['RESEND_API_KEY'], message: 'Required in production' });
    }
  });

export type Env = z.infer<typeof envSchema>;

export const ENV = Symbol('ENV');

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
