'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const prismaSrc = path.join(root, 'prisma');
const prismaDest = path.join(root, 'dist', 'prisma');

if (!fs.existsSync(prismaSrc)) {
  console.error('[hostinger-stage] pasta prisma/ nao encontrada');
  process.exit(1);
}

fs.rmSync(prismaDest, { recursive: true, force: true });
fs.cpSync(prismaSrc, prismaDest, { recursive: true });
console.log('[hostinger-stage] prisma/ copiado para dist/prisma');
