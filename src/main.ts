import { NestFactory } from '@nestjs/core';
import * as firebaseAdmin from 'firebase-admin';
import * as fs from 'fs';
import { AllExceptionsFilter } from 'src/filters/all-exception-filter';
import { setupSwagger } from 'src/swagger';
import { AppModule } from './app.module';

//firebase ;

let serviceAccount: firebaseAdmin.ServiceAccount;

if (fs.existsSync('./serviceAccount.json')) {
  // Local dev
  serviceAccount = JSON.parse(
    fs.readFileSync('./serviceAccount.json', 'utf8'),
  ) as firebaseAdmin.ServiceAccount;
} else if (fs.existsSync('/etc/secrets/serviceAccount.json')) {
  // Production (Render / Docker secret mount)
  serviceAccount = JSON.parse(
    fs.readFileSync('/etc/secrets/serviceAccount.json', 'utf8'),
  ) as firebaseAdmin.ServiceAccount;
} else {
  throw new Error('Service account file not found.');
}

if (firebaseAdmin.apps.length === 0) {
  console.log('Initializing Firebase Admin...');
  firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(serviceAccount),
  });
}

export const db = firebaseAdmin.firestore();
export const dbFireStore = firebaseAdmin.firestore;
export const dbAuth = firebaseAdmin.auth();

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
