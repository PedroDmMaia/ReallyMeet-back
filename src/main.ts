import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';

function resolveMigrationRoot(): string {
  const distDir = __dirname;
  const bundledSchema = join(distDir, 'database', 'prisma', 'schema.prisma');
  if (existsSync(bundledSchema)) {
    return join(distDir, 'database');
  }
  const repoSchema = join(distDir, '..', 'prisma', 'schema.prisma');
  if (existsSync(repoSchema)) {
    return join(distDir, '..');
  }
  return join(distDir, '..');
}

function resolvePrismaCli(startDir: string): string {
  let dir = startDir;
  for (let depth = 0; depth < 5; depth += 1) {
    const cli = join(dir, 'node_modules', 'prisma', 'build', 'index.js');
    if (existsSync(cli)) {
      return cli;
    }
    const parent = join(dir, '..');
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error('Prisma CLI não encontrado no deploy (node_modules/prisma).');
}

function runProductionMigrations(): void {
  if (process.env.SKIP_PRISMA_MIGRATE === '1') {
    return;
  }
  if (process.env.RUN_MIGRATIONS_ON_BOOT !== '1') {
    return;
  }
  const migrationRoot = resolveMigrationRoot();
  const prismaCli = resolvePrismaCli(migrationRoot);
  console.log('[really-meet] Applying Prisma migrations...', { migrationRoot });
  execSync(`node "${prismaCli}" migrate deploy`, {
    stdio: 'inherit',
    env: process.env,
    cwd: migrationRoot,
  });
}

async function bootstrap() {
  runProductionMigrations();
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
  await app.listen(port, '0.0.0.0');
  console.log(`Really Meet API em http://127.0.0.1:${port}`);
  console.log(`Swagger em http://127.0.0.1:${port}/docs`);
}

void bootstrap();
