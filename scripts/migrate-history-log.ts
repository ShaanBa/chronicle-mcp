import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function migrateCharacterData(chars: any[]): any[] {
  if (!Array.isArray(chars)) return [];

  return chars.map((c) => {
    const historyLog = Array.isArray(c.historyLog) ? [...c.historyLog] : [];

    // If historyLog is empty, seed it with existing trajectory or coreDrive note
    if (historyLog.length === 0) {
      if (c.trajectory) {
        historyLog.push({
          timestamp: c.createdAt || Date.now(),
          date: 'Initial Record',
          note: c.trajectory,
        });
      } else if (c.coreDrive) {
        historyLog.push({
          timestamp: c.createdAt || Date.now(),
          date: 'Initial Record',
          note: `Core Drive: ${c.coreDrive}`,
        });
      }
    }

    return {
      ...c,
      historyLog,
    };
  });
}

function runMigration() {
  const dataCharsPath = path.resolve(__dirname, '..', 'data', 'characters.json');
  const chroniclePath = path.resolve(__dirname, '..', 'chronicle.json');

  let migratedCount = 0;

  // 1. Migrate data/characters.json
  if (fs.existsSync(dataCharsPath)) {
    const raw = fs.readFileSync(dataCharsPath, 'utf-8');
    const chars = JSON.parse(raw);
    const updated = migrateCharacterData(chars);
    fs.writeFileSync(dataCharsPath, JSON.stringify(updated, null, 2), 'utf-8');
    migratedCount += updated.length;
    console.log(`Migrated ${updated.length} character records in data/characters.json`);
  }

  // 2. Migrate chronicle.json
  if (fs.existsSync(chroniclePath)) {
    const raw = fs.readFileSync(chroniclePath, 'utf-8');
    const chronicle = JSON.parse(raw);
    if (Array.isArray(chronicle.characters)) {
      chronicle.characters = migrateCharacterData(chronicle.characters);
      fs.writeFileSync(chroniclePath, JSON.stringify(chronicle, null, 2), 'utf-8');
      console.log(`Migrated ${chronicle.characters.length} character records in chronicle.json`);
    }
  }

  console.log('\nMigration complete! Character historyLog arrays populated.');
}

runMigration();
