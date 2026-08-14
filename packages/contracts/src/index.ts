import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'), service: z.string().min(1), version: z.string().min(1), timestamp: z.string().datetime()
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const errorResponseSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), requestId: z.string() })
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
