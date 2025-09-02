import { NestFactory } from '@nestjs/core';

import { AllExceptionsFilter } from 'src/filters/all-exception-filter';
import { setupSwagger } from 'src/swagger';
import { AppModule } from './app.module';

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

function getServiceAccount() {
  // Render mounts secret files under /etc/secrets
  const renderSecretPath = '/etc/secrets/serviceAccount.json';
  const localSecretPath = path.join(__dirname, '../serviceAccount.json');

  if (fs.existsSync(renderSecretPath)) {
    console.log('Using Render service account');
    return JSON.parse(
      fs.readFileSync(renderSecretPath, 'utf8'),
    ) as admin.ServiceAccount;
  } else if (fs.existsSync(localSecretPath)) {
    console.log('Using local service account');
    return JSON.parse(
      fs.readFileSync(localSecretPath, 'utf8'),
    ) as admin.ServiceAccount;
  } else {
    throw new Error('Service account file not found');
  }
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
