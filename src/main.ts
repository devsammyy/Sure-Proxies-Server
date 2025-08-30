import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import * as firebaseAdmin from 'firebase-admin';
import * as fs from 'fs';
import { AllExceptionsFilter } from 'src/filters/all-exception-filter';
import { AppModule } from './app.module';

const server = express();

//firebase ;
const firebaseKeyFilePath = './serviceAccount.json';
const firebaseServiceAccount = JSON.parse(
  fs.readFileSync(firebaseKeyFilePath).toString(),
) as firebaseAdmin.ServiceAccount;
if (firebaseAdmin.apps.length === 0) {
  console.log('Initialize Firebase Application.');
  firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(firebaseServiceAccount),
  });
}

export const db = firebaseAdmin.firestore();
export const dbFireStore = firebaseAdmin.firestore;
export const dbAuth = firebaseAdmin.auth();

async function bootstrap() {
  const config = new DocumentBuilder()
    .setTitle('Secure Proxy Server')
    .setDescription('API documentation for Secure Proxy Server')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  await app.init();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('', app, document);
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
