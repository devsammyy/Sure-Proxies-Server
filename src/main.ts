import { NestFactory } from '@nestjs/core';
import * as express from 'express';
import * as firebaseAdmin from 'firebase-admin';
import { AllExceptionsFilter } from 'src/common/filters/all-exception-filter';
import { setupSwagger } from 'src/swagger';
import { AppModule } from './app.module';

// const filePath = process.env.SERVICE_ACCOUNT_PATH || './serviceAccount.json';
const filePath =
  process.env.SERVICE_ACCOUNT_PATH || '/etc/secrets/serviceAccount.json';

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

  app.enableCors({
    origin: '*',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  });
  setupSwagger(app);
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
