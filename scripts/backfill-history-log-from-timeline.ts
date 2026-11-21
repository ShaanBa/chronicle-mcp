import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runBackfill(customDataDir?: string) {
  const dataDir = customDataDir || path.resolve(__dirname, '..', 'data');
  const charsPath = path.join(dataDir, 'characters.json');
  const timelinePath = path.join(dataDir, 'timeline.json');

  if (!fs.existsSync(charsPath) || !fs.existsSync(timelinePath)) {
    console.error(`Data files missing in ${dataDir}`);
    return { addedCount: 0, charReport: {} };
  }

  const characters: any[] = JSON.parse(fs.readFileSync(charsPath, 'utf-8'));
  const timeline: any[] = JSON.parse(fs.readFileSync(timelinePath, 'utf-8'));

  const charReport: Record<string, number> = {};

  for (const event of timeline) {
    if (!event.tags || !Array.isArray(event.tags)) continue;

    const gist = event.narrative.length > 120 ? event.narrative.slice(0, 120) + '...' : event.narrative;
    const noteText = `Timeline Event: ${event.title}${gist ? ` — ${gist}` : ''}`;
    const eventDate = event.date || 'Unspecified date';

    for (const rawTag of event.tags) {
      const tagLower = rawTag.trim().toLowerCase();
      if (!tagLower) continue;

      const matchingChar = characters.find(
        (c) => c.id === tagLower || c.name.trim().toLowerCase() === tagLower || c.name.trim().toLowerCase().includes(tagLower)
      );

      if (matchingChar) {
        if (!matchingChar.historyLog) {
          matchingChar.historyLog = [];
        }

        const alreadyLogged = matchingChar.historyLog.some(
          (h: any) => h.note === noteText && h.date === eventDate
        );

        if (!alreadyLogged) {
          matchingChar.historyLog.push({
            timestamp: event.createdAt || Date.now(),
            date: eventDate,
            note: noteText,
          });
          matchingChar.updatedAt = Date.now();
          charReport[matchingChar.name] = (charReport[matchingChar.name] || 0) + 1;
        }
      }
    }
  }

  fs.writeFileSync(charsPath, JSON.stringify(characters, null, 2), 'utf-8');

  // Also update chronicle.json if present
  const chroniclePath = path.resolve(__dirname, '..', 'chronicle.json');
  if (fs.existsSync(chroniclePath)) {
    try {
      const chronicle = JSON.parse(fs.readFileSync(chroniclePath, 'utf-8'));
      chronicle.characters = characters;
      fs.writeFileSync(chroniclePath, JSON.stringify(chronicle, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to update chronicle.json during backfill:', err);
    }
  }

  const totalAdded = Object.values(charReport).reduce((a, b) => a + b, 0);
  console.log('=== Retroactive History Log Backfill Report ===');
  console.log(`Total history log entries added: ${totalAdded}`);
  for (const [charName, count] of Object.entries(charReport)) {
    console.log(`- ${charName}: +${count} entries`);
  }

  return { addedCount: totalAdded, charReport };
}

// Execute if run directly
if (process.argv[1] && process.argv[1].includes('backfill-history-log-from-timeline')) {
  runBackfill();
}
