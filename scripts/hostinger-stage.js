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
console.log('[hostinger-stage] schema copiado para dist/database/prisma');
