'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const prismaSrc = path.join(root, 'prisma');
/** Nao usar dist/prisma — o Nest compila PrismaService em dist/prisma/*.js */
const databaseBundle = path.join(root, 'dist', 'database');
const prismaDest = path.join(databaseBundle, 'prisma');

if (!fs.existsSync(prismaSrc)) {
  console.error('[hostinger-stage] pasta prisma/ nao encontrada');
  process.exit(1);
}

fs.rmSync(databaseBundle, { recursive: true, force: true });
fs.mkdirSync(databaseBundle, { recursive: true });
fs.cpSync(prismaSrc, prismaDest, { recursive: true });

const migrationsDir = path.join(prismaDest, 'migrations');
const migrationCount = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => name !== 'migration_lock.toml').length
  : 0;
if (migrationCount === 0) {
  console.error('[hostinger-stage] nenhuma migration em prisma/migrations');
  process.exit(1);
}

console.log(
  `[hostinger-stage] prisma copiado para dist/database/prisma (${migrationCount} migration(s))`,
);
