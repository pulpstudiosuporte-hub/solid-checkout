import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().regex(/^(?:\d{1,3}\.){3}\d{1,3}$/, 'deve ser um endereço IPv4').default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1024).max(65535).default(3333),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:5173').transform(value => value.split(',').map(origin => origin.trim()).filter(Boolean)),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//, 'deve ser uma URL PostgreSQL').optional()
}).strict();

type RawEnvironment = z.infer<typeof environmentSchema>;
export type AppEnvironment = Omit<RawEnvironment, 'TRUST_PROXY'> & { TRUST_PROXY: boolean };

export function parseEnvironment(input: NodeJS.ProcessEnv): AppEnvironment {
  const known = {
    NODE_ENV: input.NODE_ENV, API_HOST: input.API_HOST, API_PORT: input.API_PORT,
    LOG_LEVEL: input.LOG_LEVEL, CORS_ORIGINS: input.CORS_ORIGINS, TRUST_PROXY: input.TRUST_PROXY,
    DATABASE_URL: input.DATABASE_URL
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
  return { ...result.data, TRUST_PROXY: result.data.TRUST_PROXY === 'true' };
}
