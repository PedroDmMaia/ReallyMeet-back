import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  const origins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const allowOrigin = (origin: string | undefined): boolean => {
    if (!origin) {
      return true;
    }
    if (origins.includes(origin) || origins.includes('*')) {
      return true;
    }
    // UI do desktop (JCEF) em http://127.0.0.1:<porta> ou http://localhost:<porta>
    if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
      return true;
    }
    if (/^http:\/\/localhost:\d+$/.test(origin)) {
      return true;
    }
    return false;
  };

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      callback(null, allowOrigin(origin));
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('Really Meet API')
    .setDescription('Auth, salas e tokens LiveKit')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = Number(config.get('PORT') ?? 3000);
  await app.listen(port);
  console.log(`Really Meet API em http://127.0.0.1:${port}`);
  console.log(`Swagger em http://127.0.0.1:${port}/docs`);
}

void bootstrap();
