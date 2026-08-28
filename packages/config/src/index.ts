import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().regex(/^(?:\d{1,3}\.){3}\d{1,3}$/, 'deve ser um endereço IPv4').default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1024).max(65535).default(3333),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:5173').transform(value => value.split(',').map(origin => origin.trim()).filter(Boolean)),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//, 'deve ser uma URL PostgreSQL').optional(),
  APP_URL: z.string().url().optional(),
  API_PUBLIC_URL: z.string().url().optional(),
  MEDIA_STORAGE_PATH: z.string().min(1).default('/app/uploads'),
  SHOPIFY_CLIENT_ID: z.string().min(1).optional(),
  SHOPIFY_CLIENT_SECRET: z.string().min(16).optional(),
  SHOPIFY_REDIRECT_URI: z.string().url().optional(),
  SHOPIFY_SCOPES: z.string().min(1).optional(),
  DOKPLOY_URL: z.string().url().optional(),
  DOKPLOY_API_KEY: z.string().min(16).optional(),
  DOKPLOY_CHECKOUT_APPLICATION_ID: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().startsWith('re_').optional(),
  EMAIL_FROM: z.string().min(3).max(320).optional(),
  VAPID_PUBLIC_KEY: z.string().min(40).optional(),
  VAPID_PRIVATE_KEY: z.string().min(20).optional(),
  VAPID_SUBJECT: z.string().refine(value => value.startsWith('mailto:') || /^https?:\/\//.test(value), 'deve usar mailto: ou uma URL').optional(),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
  STRIPE_PRICE_START: z.string().startsWith('price_').optional(),
  STRIPE_PRICE_PRIME: z.string().startsWith('price_').optional(),
  STRIPE_PRICE_ELITE: z.string().startsWith('price_').optional(),
  APP_ENCRYPTION_KEY: z.string().optional().refine(value => !value || Buffer.from(value, 'base64').length === 32, 'deve conter exatamente 32 bytes em base64')
}).strict();

type RawEnvironment = z.infer<typeof environmentSchema>;
export type AppEnvironment = Omit<RawEnvironment, 'TRUST_PROXY' | 'MEDIA_STORAGE_PATH'> & { TRUST_PROXY: boolean; MEDIA_STORAGE_PATH?: string };

export function parseEnvironment(input: NodeJS.ProcessEnv): AppEnvironment {
  const known = {
    NODE_ENV: input.NODE_ENV, API_HOST: input.API_HOST, API_PORT: input.API_PORT,
    LOG_LEVEL: input.LOG_LEVEL, CORS_ORIGINS: input.CORS_ORIGINS, TRUST_PROXY: input.TRUST_PROXY,
    DATABASE_URL: input.DATABASE_URL, APP_URL: input.APP_URL, API_PUBLIC_URL: input.API_PUBLIC_URL, MEDIA_STORAGE_PATH: input.MEDIA_STORAGE_PATH,
    SHOPIFY_CLIENT_ID: input.SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET: input.SHOPIFY_CLIENT_SECRET,
    SHOPIFY_REDIRECT_URI: input.SHOPIFY_REDIRECT_URI, SHOPIFY_SCOPES: input.SHOPIFY_SCOPES,
    DOKPLOY_URL: input.DOKPLOY_URL, DOKPLOY_API_KEY: input.DOKPLOY_API_KEY, DOKPLOY_CHECKOUT_APPLICATION_ID: input.DOKPLOY_CHECKOUT_APPLICATION_ID,
    APP_ENCRYPTION_KEY: input.APP_ENCRYPTION_KEY, RESEND_API_KEY: input.RESEND_API_KEY, EMAIL_FROM: input.EMAIL_FROM,
    VAPID_PUBLIC_KEY: input.VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY: input.VAPID_PRIVATE_KEY, VAPID_SUBJECT: input.VAPID_SUBJECT,
    STRIPE_SECRET_KEY: input.STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET: input.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_START: input.STRIPE_PRICE_START, STRIPE_PRICE_PRIME: input.STRIPE_PRICE_PRIME, STRIPE_PRICE_ELITE: input.STRIPE_PRICE_ELITE
  };
  const result = environmentSchema.safeParse(known);
  if (!result.success) {
    const issues = result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Configuração de ambiente inválida: ${issues}`);
  }
  if (result.data.NODE_ENV === 'production' && result.data.CORS_ORIGINS.some(origin => origin.includes('localhost'))) {
    throw new Error('CORS_ORIGINS não pode usar localhost em produção');
  }
  if (result.data.NODE_ENV === 'production' && !result.data.DATABASE_URL) throw new Error('DATABASE_URL é obrigatória em produção');
  if (result.data.NODE_ENV === 'production' && !result.data.APP_ENCRYPTION_KEY) throw new Error('APP_ENCRYPTION_KEY é obrigatória em produção');
  const shopifyValues = [result.data.APP_URL, result.data.SHOPIFY_CLIENT_ID, result.data.SHOPIFY_CLIENT_SECRET, result.data.SHOPIFY_REDIRECT_URI, result.data.APP_ENCRYPTION_KEY];
  if (shopifyValues.some(Boolean) && !shopifyValues.every(Boolean)) throw new Error('A configuração Shopify está incompleta');
  const dokployValues = [result.data.DOKPLOY_URL, result.data.DOKPLOY_API_KEY, result.data.DOKPLOY_CHECKOUT_APPLICATION_ID];
  if (dokployValues.some(Boolean) && !dokployValues.every(Boolean)) throw new Error('A configuração Dokploy está incompleta');
  if (Boolean(result.data.RESEND_API_KEY) !== Boolean(result.data.EMAIL_FROM)) throw new Error('A configuração de e-mail está incompleta');
  const vapidValues = [result.data.VAPID_PUBLIC_KEY, result.data.VAPID_PRIVATE_KEY, result.data.VAPID_SUBJECT];
  if (vapidValues.some(Boolean) && !vapidValues.every(Boolean)) throw new Error('A configura\u00e7\u00e3o Web Push est\u00e1 incompleta');
  const stripeValues = [result.data.STRIPE_SECRET_KEY, result.data.STRIPE_WEBHOOK_SECRET, result.data.STRIPE_PRICE_START, result.data.STRIPE_PRICE_PRIME, result.data.STRIPE_PRICE_ELITE];
  if (stripeValues.some(Boolean) && !stripeValues.every(Boolean)) throw new Error('A configura\u00e7\u00e3o Stripe est\u00e1 incompleta');
  return { ...result.data, TRUST_PROXY: result.data.TRUST_PROXY === 'true' };
}
