import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Storage } from '../src/storage.js';
import { upsertCharacter } from '../src/tools/characters.js';
import { logTimelineEvent } from '../src/tools/timeline.js';
import { upsertTome } from '../src/tools/tomes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseTags(rawTags: any): string[] {
  if (Array.isArray(rawTags)) {
    return rawTags.map((t) => String(t).trim()).filter(Boolean);
  }
  if (typeof rawTags === 'string') {
    return rawTags.split(',').map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

export function importWebExport(importFilePath: string) {
  const absolutePath = path.resolve(importFilePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`Import file not found: ${absolutePath}`);
    process.exit(1);
  }

  const rawContent = fs.readFileSync(absolutePath, 'utf-8');
  const data = JSON.parse(rawContent);
  const storage = new Storage();

  let importedChars = 0;
  let importedEvents = 0;
  let importedTomes = 0;

  // 1. Import Characters
  if (Array.isArray(data.characters)) {
    for (const c of data.characters) {
      upsertCharacter(storage, {
        id: c.id,
        name: c.name,
        house: c.house,
        status: c.status || 'alive',
        tags: parseTags(c.tags),
        face: c.face,
        voice: c.voice,
        coreDrive: c.coreDrive || c.ambition,
        flaw: c.flaw,
        modernAnalogue: c.modernAnalogue,
        relationships: typeof c.relationships === 'object' ? JSON.stringify(c.relationships, null, 2) : c.relationships,
        trajectory: c.trajectory,
      });
      importedChars++;
    }
  }

  // 2. Import Timeline Entries
  if (Array.isArray(data.timeline)) {
    for (const e of data.timeline) {
      logTimelineEvent(storage, {
        title: e.title,
        date: e.date,
        tags: parseTags(e.tags),
        narrative: e.narrative || e.content || e.summary,
      });
      importedEvents++;
    }
  }

  // 3. Import Tomes
  if (Array.isArray(data.tomes)) {
    for (const t of data.tomes) {
      upsertTome(storage, {
        id: t.id,
        title: t.title,
        category: t.category,
        tags: parseTags(t.tags),
        content: t.content || t.text,
      });
      importedTomes++;
    }
  }

  storage.flushAll();
  console.log(`\nImport complete!`);
  console.log(`- Characters imported: ${importedChars}`);
  console.log(`- Timeline events imported: ${importedEvents}`);
  console.log(`- Tomes imported: ${importedTomes}`);
}

const args = process.argv.slice(2);
if (args.length > 0) {
  importWebExport(args[0]);
} else {
  console.log(`Usage: npx tsx scripts/import-from-web-export.ts <path-to-web-export.json>`);
}
