import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.resolve(__dirname, '..', 'data');
const backupDir = path.resolve(__dirname, '..', 'data-backup-pre-campaigns');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const files = fs.readdirSync(srcDir);
for (const file of files) {
  const srcFile = path.join(srcDir, file);
  const destFile = path.join(backupDir, file);
  if (fs.statSync(srcFile).isFile()) {
    fs.copyFileSync(srcFile, destFile);
    console.log(`Backed up ${file} to data-backup-pre-campaigns/`);
  }
}

console.log('Backup complete!');
