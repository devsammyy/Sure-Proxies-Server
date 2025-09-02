import { NestFactory } from '@nestjs/core';

import { AllExceptionsFilter } from 'src/filters/all-exception-filter';
import { setupSwagger } from 'src/swagger';
import { AppModule } from './app.module';

import * as admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

function getServiceAccount() {
  const filePath =
    process.env.NODE_ENV === 'production'
      ? '/etc/secrets/serviceAccount.json' // Render path
      : join(__dirname, '..', 'serviceAccount.json'); // Local dev path

  if (!existsSync(filePath)) {
    throw new Error('Service account file not found at ' + filePath);
  }

  return JSON.parse(readFileSync(filePath, 'utf8'));
}

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(getServiceAccount()),
  });
}

export const db = admin.firestore();
export const dbFireStore = admin.firestore;
export const dbAuth = admin.auth();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupSwagger(app);
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
