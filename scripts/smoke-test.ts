import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

import { Storage, generateId } from '../src/storage.js';
import {
  listCampaigns,
  createCampaign,
  setActiveCampaign,
  getActiveCampaign,
} from '../src/tools/campaigns.js';
import {
  listCharacters,
  getCharacter,
  findCharacterByName,
  upsertCharacter,
  deleteCharacter,
} from '../src/tools/characters.js';
import {
  listTimeline,
  getTimelineEntry,
  logTimelineEvent,
  updateTimelineEntry,
  deleteTimelineEntry,
} from '../src/tools/timeline.js';
import {
  listTomes,
  getTome,
  findTomeByTitle,
  upsertTome,
  deleteTome,
} from '../src/tools/tomes.js';
import {
  addRelationship,
  listRelationships,
  removeRelationship,
} from '../src/tools/relationships.js';
import {
  listThreads,
  getThread,
  upsertThread,
  resolveThread,
  deleteThread,
} from '../src/tools/threads.js';
import {
  listHouses,
  getHouse,
  findHouseByName,
  upsertHouse,
  deleteHouse,
} from '../src/tools/houses.js';
import {
  searchChronicle,
  getRealmRecap,
} from '../src/tools/search.js';
import { runCampaignMigration } from './migrate-add-campaign-id.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSmokeTest() {
  console.log('=== Starting Full Scoping & Multi-Campaign Smoke Test Suite ===\n');

  const scratchDataDir = path.resolve(__dirname, '..', 'data-test-multicampaign');
  if (fs.existsSync(scratchDataDir)) {
    fs.rmSync(scratchDataDir, { recursive: true, force: true });
  }

  process.env.CHRONICLE_DATA_DIR = scratchDataDir;
  console.log(`Scratch data dir: ${scratchDataDir}\n`);

  const storage = new Storage(scratchDataDir);

  let passed = 0;
  let failed = 0;

  function check(description: string, fn: () => void) {
    try {
      fn();
      console.log(`  [PASS] ${description}`);
      passed++;
    } catch (err: any) {
      console.error(`  [FAIL] ${description}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Campaign Setup & Creation
  console.log('Test 1: Campaign Creation & Default State');
  const defaultCamp = getActiveCampaign(storage);
  check('Default active campaign initialized', () => {
    assert(defaultCamp.success === true && Boolean(defaultCamp.campaign.id), 'Active campaign initialized');
  });

  const campARes = createCampaign(storage, 'Epirus');
  const campBRes = createCampaign(storage, 'Britannia');
  check('Created Campaign A (Epirus)', () => {
    assert(campARes.success === true && Boolean(campARes.campaign), 'Campaign A created');
  });
  check('Created Campaign B (Britannia)', () => {
    assert(campBRes.success === true && Boolean(campBRes.campaign), 'Campaign B created');
  });

  const campAId = campARes.campaign!.id;
  const campBId = campBRes.campaign!.id;

  // 2. Populate Campaign A ("Epirus") & Verify Creation Stamping
  console.log('\nTest 2: Populating Campaign A (Epirus) & Creation Stamping');
  setActiveCampaign(storage, campAId);

  const charARes = upsertCharacter(storage, { name: 'Pyrrhus of Epirus', house: 'Aeacidae', note: 'Hero of Epirus' });
  const tomeARes = upsertTome(storage, { title: 'Epirus War Tactics', category: 'Military', content: 'Elephants in battle' });
  const threadARes = upsertThread(storage, { title: 'The Tarentum Alliance', summary: 'Negotiations with Tarentum', status: 'open' });
  const houseARes = upsertHouse(storage, { name: 'House Aeacidae', status: 'ruling' });
  const eventARes = logTimelineEvent(storage, { title: 'Battle of Heraclea', date: '280 BC', tags: ['Pyrrhus of Epirus'], narrative: 'Pyrrhic victory against Rome.' });

  const charAId = charARes.character!.id;
  const tomeAId = tomeARes.tome!.id;
  const threadAId = threadARes.thread!.id;
  const houseAId = houseARes.house!.id;
  const eventAId = eventARes.entry.id;

  check('upsertCharacter stamps character record with activeCampaignId', () => {
    assert(charARes.character!.campaignId === campAId, 'Character A stamped with campAId');
  });
  check('upsertTome stamps tome record with activeCampaignId', () => {
    assert(tomeARes.tome!.campaignId === campAId, 'Tome A stamped with campAId');
  });
  check('upsertThread stamps thread record with activeCampaignId', () => {
    assert(threadARes.thread!.campaignId === campAId, 'Thread A stamped with campAId');
  });
  check('upsertHouse stamps house record with activeCampaignId', () => {
    assert(houseARes.house!.campaignId === campAId, 'House A stamped with campAId');
  });
  check('logTimelineEvent stamps timeline entry with activeCampaignId', () => {
    assert(eventARes.entry.campaignId === campAId, 'Event A stamped with campAId');
  });

  // 3. Switch to Campaign B ("Britannia") and Populate
  console.log('\nTest 3: Switching to Campaign B (Britannia) & Populating');
  setActiveCampaign(storage, campBId);

  const charBRes = upsertCharacter(storage, { name: 'King Arthur', house: 'Pendragon', note: 'King of Britons' });
  const tomeBRes = upsertTome(storage, { title: 'Book of Excalibur', category: 'Relic', content: 'Sword from the lake' });
  const threadBRes = upsertThread(storage, { title: 'Quest for the Holy Grail', summary: 'Knights of the Round Table quest', status: 'open' });
  const houseBRes = upsertHouse(storage, { name: 'House Pendragon', status: 'ruling' });
  const eventBRes = logTimelineEvent(storage, { title: 'Battle of Badon', date: '500 AD', tags: ['King Arthur'], narrative: 'Arthur defeats Anglo-Saxon invaders.' });

  const charBId = charBRes.character!.id;
  const tomeBId = tomeBRes.tome!.id;
  const threadBId = threadBRes.thread!.id;
  const houseBId = houseBRes.house!.id;
  const eventBId = eventBRes.entry.id;

  // 4. Test List Tools Scoping under Campaign B
  console.log('\nTest 4: List Tools Scoping under Campaign B');
  check('list_characters under Campaign B strictly returns Campaign B characters', () => {
    const res = listCharacters(storage);
    assert(res.count === 1 && res.characters[0].id === charBId, 'list_characters returned charBId');
  });
  check('list_tomes under Campaign B strictly returns Campaign B tomes', () => {
    const res = listTomes(storage);
    assert(res.count === 1 && res.tomes[0].id === tomeBId, 'list_tomes returned tomeBId');
  });
  check('list_threads under Campaign B strictly returns Campaign B threads', () => {
    const res = listThreads(storage);
    assert(res.count === 1 && res.threads[0].id === threadBId, 'list_threads returned threadBId');
  });
  check('list_houses under Campaign B strictly returns Campaign B houses', () => {
    const res = listHouses(storage);
    assert(res.count === 1 && res.houses[0].id === houseBId, 'list_houses returned houseBId');
  });
  check('list_timeline under Campaign B strictly returns Campaign B timeline entries', () => {
    const res = listTimeline(storage);
    assert(res.count === 1 && res.entries[0].id === eventBId, 'list_timeline returned eventBId');
  });

  // 5. Test Get (Read) Tools on Foreign-Campaign IDs (Campaign A IDs while Campaign B is active)
  console.log('\nTest 5: Read (Get) Tools Scoping on Foreign-Campaign IDs');
  check('get_character on foreign ID returns success: false with "not found in active campaign"', () => {
    const res = getCharacter(storage, charAId);
    assert(res.success === false, 'success is false');
    assert(res.message!.includes('not found in active campaign'), `Message contains expected error: "${res.message}"`);
  });
  check('get_tome on foreign ID returns success: false with "not found in active campaign"', () => {
    const res = getTome(storage, tomeAId);
    assert(res.success === false, 'success is false');
    assert(res.message!.includes('not found in active campaign'), `Message contains expected error: "${res.message}"`);
  });
  check('get_thread on foreign ID returns success: false with "not found in active campaign"', () => {
    const res = getThread(storage, threadAId);
    assert(res.success === false, 'success is false');
    assert(res.message!.includes('not found in active campaign'), `Message contains expected error: "${res.message}"`);
  });
  check('get_house on foreign ID returns success: false with "not found in active campaign"', () => {
    const res = getHouse(storage, houseAId);
    assert(res.success === false, 'success is false');
    assert(res.message!.includes('not found in active campaign'), `Message contains expected error: "${res.message}"`);
  });
  check('get_timeline_entry on foreign ID returns success: false with "not found in active campaign"', () => {
    const res = getTimelineEntry(storage, eventAId);
    assert(res.success === false, 'success is false');
    assert(res.message!.includes('not found in active campaign'), `Message contains expected error: "${res.message}"`);
  });

  // 6. Test Update (Write) Tools on Foreign-Campaign IDs (Campaign A IDs while Campaign B is active)
  console.log('\nTest 6: Update (Write) Tools Scoping on Foreign-Campaign IDs');
  check('upsert_character update on foreign ID fails safely with "not found in active campaign"', () => {
    const res = upsertCharacter(storage, { id: charAId, name: 'Pyrrhus Malicious Edit' });
    assert(res.success === false, 'success is false');
    assert(res.message!.includes('not found in active campaign'), `Message contains expected error: "${res.message}"`);
  });
  check('upsert_tome update on foreign ID fails safely with "not found in active campaign"', () => {
    const res = upsertTome(storage, { id: tomeAId, title: 'Tactics Malicious Edit', content: 'Corrupted' });
    assert(res.success === false, 'success is false');
    assert(res.message!.includes('not found in active campaign'), `Message contains expected error: "${res.message}"`);
  });
  check('upsert_thread update on foreign ID fails safely with "not found in active campaign"', () => {
    const res = upsertThread(storage, { id: threadAId, title: 'Alliance Malicious Edit', summary: 'Corrupted' });
    assert(res.success === false, 'success is false');
    assert(res.message!.includes('not found in active campaign'), `Message contains expected error: "${res.message}"`);
  });
  check('upsert_house update on foreign ID fails safely with "not found in active campaign"', () => {
    const res = upsertHouse(storage, { id: houseAId, name: 'House Malicious Edit' });
    assert(res.success === false, 'success is false');
    assert(res.message!.includes('not found in active campaign'), `Message contains expected error: "${res.message}"`);
  });
  check('update_timeline_entry update on foreign ID fails safely with "not found in active campaign"', () => {
    const res = updateTimelineEntry(storage, eventAId, { title: 'Heraclea Malicious Edit' });
    assert(res.success === false, 'success is false');
    assert(res.message!.includes('not found in active campaign'), `Message contains expected error: "${res.message}"`);
  });

  // 7. Test Delete Tools on Foreign-Campaign IDs (Campaign A IDs while Campaign B is active)
  console.log('\nTest 7: Delete Tools Scoping on Foreign-Campaign IDs');
  check('delete_character on foreign ID fails safely with "not found in active campaign"', () => {
    const res = deleteCharacter(storage, charAId);
    assert(res.success === false, 'success is false');
    assert(res.message!.includes('not found in active campaign'), `Message contains expected error: "${res.message}"`);
  });
  check('delete_tome on foreign ID fails safely with "not found in active campaign"', () => {
    const res = deleteTome(storage, tomeAId);
    assert(res.success === false, 'success is false');
    assert(res.message!.includes('not found in active campaign'), `Message contains expected error: "${res.message}"`);
  });
  check('delete_thread on foreign ID fails safely with "not found in active campaign"', () => {
    const res = deleteThread(storage, threadAId);
    assert(res.success === false, 'success is false');
    assert(res.message!.includes('not found in active campaign'), `Message contains expected error: "${res.message}"`);
  });
  check('delete_house on foreign ID fails safely with "not found in active campaign"', () => {
    const res = deleteHouse(storage, houseAId);
    assert(res.success === false, 'success is false');
    assert(res.message!.includes('not found in active campaign'), `Message contains expected error: "${res.message}"`);
  });
  check('delete_timeline_entry on foreign ID fails safely with "not found in active campaign"', () => {
    const res = deleteTimelineEntry(storage, eventAId);
    assert(res.success === false, 'success is false');
    assert(res.message!.includes('not found in active campaign'), `Message contains expected error: "${res.message}"`);
  });

  // 8. Test search_chronicle Scoping Across All 5 Sections
  console.log('\nTest 8: Global Search Scoping Across All 5 Sections');
  const searchRes = searchChronicle(storage, 'Epirus');
  check('search_chronicle returned success status', () => {
    assert(searchRes.success === true, 'search_chronicle returned success');
  });
  check('search_chronicle excludes foreign characters section', () => {
    assert(searchRes.results.characters.length === 0, '0 foreign characters returned');
  });
  check('search_chronicle excludes foreign timeline section', () => {
    assert(searchRes.results.timeline.length === 0, '0 foreign timeline entries returned');
  });
  check('search_chronicle excludes foreign tomes section', () => {
    assert(searchRes.results.tomes.length === 0, '0 foreign tomes returned');
  });
  check('search_chronicle excludes foreign threads section', () => {
    assert(searchRes.results.threads.length === 0, '0 foreign threads returned');
  });
  check('search_chronicle excludes foreign houses section', () => {
    assert(searchRes.results.houses.length === 0, '0 foreign houses returned');
  });

  // 9. Cross-Campaign Relationships Refusal
  console.log('\nTest 9: Cross-Campaign Relationship Protection');
  const crossRelRes = addRelationship(storage, {
    fromType: 'character',
    fromId: charBId, // Active campaign (Britannia)
    toType: 'character',
    toId: charAId, // Inactive campaign (Epirus)
    type: 'ally',
  });

  check('add_relationship between active and inactive campaign entities is refused with "not found in active campaign"', () => {
    assert(crossRelRes.success === false, 'add_relationship returned success: false');
    assert(crossRelRes.message!.includes('not found in active campaign'), `Message contains expected error: "${crossRelRes.message}"`);
  });

  // 10. Realm Recap Campaign Injection
  console.log('\nTest 10: get_realm_recap Campaign Metadata Injection');
  const recapRes = getRealmRecap(storage);
  check('get_realm_recap includes active campaign name ("Britannia") and ID', () => {
    assert(recapRes.success === true, 'get_realm_recap returned success');
    assert(recapRes.recap.campaign === 'Britannia', 'Recap campaign name is Britannia');
    assert(recapRes.recap.campaignId === campBId, 'Recap campaignId is campBId');
  });

  // 11. Switch back to Campaign A and verify full integrity
  console.log('\nTest 11: Switching Back to Campaign A & Confirming Integrity');
  setActiveCampaign(storage, campAId);

  check('Switching back to Campaign A restores Character A intact', () => {
    assert(getCharacter(storage, charAId).success === true, 'Character A fetched');
  });
  check('Switching back to Campaign A restores Tome A intact', () => {
    assert(getTome(storage, tomeAId).success === true, 'Tome A fetched');
  });
  check('Switching back to Campaign A restores Thread A intact', () => {
    assert(getThread(storage, threadAId).success === true, 'Thread A fetched');
  });
  check('Switching back to Campaign A restores House A intact', () => {
    assert(getHouse(storage, houseAId).success === true, 'House A fetched');
  });
  check('Switching back to Campaign A restores Event A intact', () => {
    assert(getTimelineEntry(storage, eventAId).success === true, 'Event A fetched');
  });

  // 12. Pre-upgrade Migration Stamping
  console.log('\nTest 12: Pre-upgrade Migration Dataset Stamping');
  storage.flushAll();

  const rawCharsPath = path.join(scratchDataDir, 'characters.json');
  const rawChars: any[] = JSON.parse(fs.readFileSync(rawCharsPath, 'utf-8'));
  rawChars.push({
    id: 'legacy-char-999',
    name: 'Legacy Alexander',
    status: 'alive',
    tags: ['Legacy'],
    createdAt: Date.now() - 500000,
    updatedAt: Date.now() - 500000,
  });
  fs.writeFileSync(rawCharsPath, JSON.stringify(rawChars, null, 2), 'utf-8');

  const migrationRes = runCampaignMigration(scratchDataDir);
  check('Migration script stamps un-scoped legacy records with campaignId: "campaign-semien"', () => {
    assert(migrationRes.report['characters.json'] >= 1, 'Legacy character stamped');
    const reloadedChars: any[] = JSON.parse(fs.readFileSync(rawCharsPath, 'utf-8'));
    const legacy = reloadedChars.find((c) => c.id === 'legacy-char-999');
    assert(legacy && legacy.campaignId === 'campaign-semien', 'Legacy record stamped with campaign-semien');
  });

  // Clean up scratch directory
  if (fs.existsSync(scratchDataDir)) {
    fs.rmSync(scratchDataDir, { recursive: true, force: true });
    console.log(`\nCleaned up scratch data directory ${scratchDataDir}`);
  }

  console.log('\n=== Smoke Test Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.error('\nSmoke test FAILED!');
    process.exit(1);
  } else {
    console.log('\nFull Scoping Smoke Test PASSED successfully!');
  }
}

runSmokeTest().catch((err) => {
  console.error('Fatal error running smoke test:', err);
  process.exit(1);
});
