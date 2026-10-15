'use strict';

const { execSync } = require('node:child_process');

if (process.env.SKIP_PRISMA_MIGRATE !== '1') {
  console.log('[really-meet] Applying Prisma migrations...');
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
  } catch (error) {
    console.error('[really-meet] Migration failed.');
    throw error;
  }
}

require('./dist/main');
