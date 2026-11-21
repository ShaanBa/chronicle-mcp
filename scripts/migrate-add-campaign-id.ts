import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runCampaignMigration(targetDataDir?: string) {
  const dataDir = targetDataDir || path.resolve(__dirname, '..', 'data');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const campaignsFile = path.join(dataDir, 'campaigns.json');
  const activeCampaignFile = path.join(dataDir, 'active-campaign.json');

  const filesToMigrate = [
    'characters.json',
    'timeline.json',
    'tomes.json',
    'relationships.json',
    'threads.json',
    'houses.json',
  ];

  // 1. Find earliest timestamp across existing records
  let earliestTimestamp = Date.now();
  for (const filename of filesToMigrate) {
    const filePath = path.join(dataDir, filename);
    if (fs.existsSync(filePath)) {
      try {
        const records = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (Array.isArray(records)) {
          for (const r of records) {
            if (r.createdAt && typeof r.createdAt === 'number' && r.createdAt < earliestTimestamp) {
              earliestTimestamp = r.createdAt;
            }
          }
        }
      } catch (e) {
        // ignore unparseable files during timestamp scan
      }
    }
  }

  // 2. Seed campaigns.json if missing or empty
  let campaigns: any[] = [];
  if (fs.existsSync(campaignsFile)) {
    try {
      campaigns = JSON.parse(fs.readFileSync(campaignsFile, 'utf-8'));
    } catch (e) {
      campaigns = [];
    }
  }

  if (!Array.isArray(campaigns) || campaigns.length === 0) {
    campaigns = [
      {
        id: 'campaign-semien',
        name: 'Semien',
        createdAt: earliestTimestamp,
        lastActiveAt: Date.now(),
      },
    ];
    fs.writeFileSync(campaignsFile, JSON.stringify(campaigns, null, 2), 'utf-8');
  }

  // 3. Seed active-campaign.json if missing
  if (!fs.existsSync(activeCampaignFile)) {
    fs.writeFileSync(
      activeCampaignFile,
      JSON.stringify({ activeCampaignId: 'campaign-semien' }, null, 2),
      'utf-8'
    );
  }

  // 4. Stamp campaignId: "campaign-semien" on all records in 6 data files
  const report: Record<string, number> = {};

  for (const filename of filesToMigrate) {
    const filePath = path.join(dataDir, filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf-8');
      report[filename] = 0;
      continue;
    }

    try {
      const records = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (Array.isArray(records)) {
        let stampedCount = 0;
        const updated = records.map((r) => {
          if (!r.campaignId) {
            stampedCount++;
            return { ...r, campaignId: 'campaign-semien' };
          }
          return r;
        });

        fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
        report[filename] = stampedCount;
      }
    } catch (err) {
      console.error(`[migration] Error processing ${filename}:`, err);
    }
  }

  // 5. Update chronicle.json if present
  const chroniclePath = path.resolve(__dirname, '..', 'chronicle.json');
  if (fs.existsSync(chroniclePath)) {
    try {
      const chronicle = JSON.parse(fs.readFileSync(chroniclePath, 'utf-8'));
      if (Array.isArray(chronicle.characters)) {
        chronicle.characters = chronicle.characters.map((c: any) => ({
          ...c,
          campaignId: c.campaignId || 'campaign-semien',
        }));
      }
      if (Array.isArray(chronicle.timeline)) {
        chronicle.timeline = chronicle.timeline.map((e: any) => ({
          ...e,
          campaignId: e.campaignId || 'campaign-semien',
        }));
      }
      fs.writeFileSync(chroniclePath, JSON.stringify(chronicle, null, 2), 'utf-8');
    } catch (e) {
      console.error('[migration] Error updating chronicle.json:', e);
    }
  }

  console.log('=== Multi-Campaign Migration Summary ===');
  console.log(`Default active campaign: campaign-semien ("Semien")`);
  for (const [file, count] of Object.entries(report)) {
    console.log(`- ${file}: ${count} records stamped with campaignId`);
  }

  return { campaigns, report };
}

// Execute if run directly
if (process.argv[1] && process.argv[1].includes('migrate-add-campaign-id')) {
  runCampaignMigration();
}
