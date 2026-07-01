import { z } from 'zod';

export const MAX_PARTICIPANTS = 4;

const EMPTY_TIMEOUT_SECONDS = 300;

const envSchema = z.object({
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  // LIVEKIT_URL is the client-facing signalling endpoint (ws://|wss://); LIVEKIT_HOST is the
  // server API endpoint (http://|https://). Both must be syntactically valid URLs.
  LIVEKIT_URL: z.url(),
  LIVEKIT_HOST: z.url(),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export type AppConfig = {
  livekitApiKey: string;
  livekitApiSecret: string;
  livekitUrl: string;
  livekitHost: string;
  port: number;
  corsOrigin: string;
  maxParticipants: number;
  emptyTimeoutSeconds: number;
};

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const e = parsed.data;
  return {
    livekitApiKey: e.LIVEKIT_API_KEY,
    livekitApiSecret: e.LIVEKIT_API_SECRET,
    livekitUrl: e.LIVEKIT_URL,
    livekitHost: e.LIVEKIT_HOST,
    port: e.PORT,
    corsOrigin: e.CORS_ORIGIN,
    maxParticipants: MAX_PARTICIPANTS,
    emptyTimeoutSeconds: EMPTY_TIMEOUT_SECONDS,
  };
}
