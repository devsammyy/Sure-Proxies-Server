import { NestFactory } from '@nestjs/core';
import * as express from 'express';
import * as firebaseAdmin from 'firebase-admin';
import { AllExceptionsFilter } from 'src/common/filters/all-exception-filter';
import { setupSwagger } from 'src/swagger';
import { AppModule } from './app.module';
import { env, isDev, parseOrigins } from './config';

const filePath = env.SERVICE_ACCOUNT_PATH;
// const filePath =
//   process.env.SERVICE_ACCOUNT_PATH || '/etc/secrets/serviceAccount.json';

firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(filePath),
});

export const db = firebaseAdmin.firestore();
export const dbFireStore = firebaseAdmin.firestore;
export const dbAuth = firebaseAdmin.auth();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(
    express.json({
      verify: (req: express.Request & { rawBody?: string }, _res, buf) => {
        if (req.originalUrl.startsWith('/webhook')) {
          req.rawBody = buf.toString();
        }
      },
    }),
  );

  // CORS: cannot use wildcard '*' together with credentials. Reflect only approved origins.
  // --- CORS CONFIG (enhanced diagnostics) ---
  const sanitize = (val?: string) =>
    (val || '')
      .trim()
      .replace(/^['"]|['"]$/g, '') // strip wrapping quotes if present
      .replace(/\/$/, ''); // strip trailing slash

  const extraOrigins = parseOrigins(env.CORS_ORIGINS || '').map(sanitize);

  const allowList = [
    'http://localhost:3000',
    'https://sure-proxies.vercel.app',
    'http://127.0.0.1:3000',
    'http://localhost:3002',

    sanitize(env.FRONTEND_URL), // primary frontend
    ...extraOrigins,
  ]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i); // dedupe

  const baseDomain = sanitize(env.FRONTEND_BASE_DOMAIN); // e.g. myapp.com
  if (isDev) {
    console.log('[CORS] Allow list:', allowList);
    if (baseDomain) console.log('[CORS] Base domain wildcard:', baseDomain);
  }

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const cleaned = sanitize(origin);
      if (!origin) {
        // non-browser or same-origin
        callback(null, true);
        return;
      }
      if (allowList.includes(cleaned)) {
        callback(null, true);
        return;
      }
      if (baseDomain && cleaned.endsWith('.' + baseDomain)) {
        callback(null, true);
        return;
      }
      if (isDev && process.env.CORS_FALLBACK_ALLOW_ALL === '1') {
        console.warn(
          '[CORS] Fallback allowing origin (dev override):',
          cleaned,
        );
        callback(null, true);
        return;
      }
      console.warn('[CORS] Blocked origin:', origin, 'Cleaned:', cleaned);
      callback(new Error('Not allowed by CORS'));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    // allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    credentials: true,
    maxAge: 600,
  });
  setupSwagger(app);
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(env.PORT ?? 3002);
}
bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
