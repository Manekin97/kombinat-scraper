import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const publicDir = path.join(process.cwd(), 'public');
const apiDir = path.join(process.cwd(), 'api');

execSync('ncc build src/cron.ts -o api -m', { stdio: 'inherit' });

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}


