import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const publicDir = path.join(process.cwd(), 'public');
const distDir = path.join(process.cwd(), 'dist');

execSync('ncc build src/cron.ts -o dist -m', { stdio: 'inherit' });

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}


