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
  updateRealmPulse,
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
import {
  upsertSecret,
  updateSecretKnowledge,
  listSecrets,
  getCharacterKnowledge,
} from '../src/tools/secrets.js';
import {
  getSceneBriefing,
} from '../src/tools/director.js';
import {
  attachComputedAge,
  resolveEntityRef,
  resolveCharacterRef,
} from '../src/storage.js';
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

  // 13. Legacy Campaign Compatibility
  console.log('\nTest 13: Legacy Campaign Compatibility (Pre-Phase-1 compatibility)');
  const campLegacyRes = createCampaign(storage, 'Legacy Westeros');
  const campLegacyId = campLegacyRes.campaign.id;
  setActiveCampaign(storage, campLegacyId);

  // Directly insert a legacy un-augmented character and tome
  const legacyChar = {
    id: 'char-legacy-robert',
    campaignId: campLegacyId,
    name: 'Robert Baratheon',
    status: 'alive' as const,
    tags: ['King'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  storage.characters.push(legacyChar);

  const legacyTome = {
    id: 'tome-legacy-lineage',
    campaignId: campLegacyId,
    title: 'The Lineages and Histories of the Great Houses',
    content: 'A massive book by Grand Maester Malleon.',
    tags: ['Lineage'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  storage.tomes.push(legacyTome);

  check('Legacy campaign loads getRealmRecap with zero errors and empty pulse fallback', () => {
    const recap = getRealmRecap(storage);
    assert(recap.success === true, 'getRealmRecap succeeded on legacy campaign');
    assert(recap.recap.campaign === 'Legacy Westeros', 'Recap campaign name matches');
    assert(Array.isArray(recap.recap.activeSecretsSummary.secrets), 'activeSecretsSummary.secrets is array');
  });

  check('Legacy campaign searchChronicle succeeds with 6 sections', () => {
    const search = searchChronicle(storage, 'Baratheon');
    assert(search.success === true, 'searchChronicle succeeded');
    assert(search.results.characters.length === 1, 'Found legacy character');
    assert(Array.isArray(search.results.secrets), 'secrets section exists');
  });

  check('Legacy campaign listCharacters succeeds without errors', () => {
    const chars = listCharacters(storage);
    assert(chars.success === true, 'listCharacters succeeded');
    assert(chars.characters.some((c) => c.name === 'Robert Baratheon'), 'Found legacy character in list');
  });

  // 14. Name-to-ID Resolution Everywhere
  console.log('\nTest 14: Name-to-ID Resolution Everywhere');
  const raymundCharRes = upsertCharacter(storage, {
    name: 'Lord Raymund Mooton',
    status: 'alive',
    house: 'Mooton',
  });
  const raymundId = raymundCharRes.character.id;

  const secret14Res = upsertSecret(storage, {
    title: 'Smuggled Dragon Eggs',
    truth: 'Three dragon eggs are hidden in the Maidenpool salt cellars.',
    publicCoverStory: 'Shipment of Essosi spices.',
    severity: 'treason',
    status: 'buried',
    subjectIds: ['Lord Raymund Mooton'],
    knownByCharacterIds: ['Lord Raymund Mooton'],
  });

  check('upsertSecret resolves character name to canonical UUID on write', () => {
    assert(secret14Res.success === true, 'Secret created');
    assert(secret14Res.secret.knownByCharacterIds.includes(raymundId), 'knownBy contains canonical UUID');
    assert(!secret14Res.secret.knownByCharacterIds.includes('Lord Raymund Mooton'), 'Raw name string was replaced');
    assert(secret14Res.secret.subjectIds.includes(raymundId), 'subjectIds contains canonical UUID');
  });

  check('getCharacterKnowledge resolves character name and retrieves known secrets', () => {
    const knowRes = getCharacterKnowledge(storage, { characterId: 'Lord Raymund Mooton' });
    assert(knowRes.success === true, 'getCharacterKnowledge succeeded');
    assert(knowRes.characterId === raymundId, 'Resolved to raymundId');
    assert(knowRes.knowsCount === 1, 'knowsCount is 1');
    assert(knowRes.knows[0].title === 'Smuggled Dragon Eggs', 'Found secret in knows list');
    assert(knowRes.knows[0].truth.includes('salt cellars'), 'Truth included for known secret');
  });

  // 15. Knowledge Superseding
  console.log('\nTest 15: Knowledge Superseding (Knowing supersedes Suspecting)');
  const charMallisterRes = upsertCharacter(storage, { name: 'Ser Jason Mallister', status: 'alive' });
  const charMallisterId = charMallisterRes.character.id;

  const secret15Res = upsertSecret(storage, {
    title: 'Poisoned Chalice Plot',
    truth: 'Strangler crystals bought from the Alchemists Guild.',
    publicCoverStory: 'Wine turned sour in the barrel.',
    severity: 'scandal',
    status: 'buried',
    suspectedByCharacterIds: ['Ser Jason Mallister'],
  });
  const secret15Id = secret15Res.secret.id;

  check('Initial secret state puts character in suspectedBy and not knownBy', () => {
    const s = storage.secrets.find((sec) => sec.id === secret15Id)!;
    assert(s.suspectedByCharacterIds.includes(charMallisterId), 'Jason is suspectedBy');
    assert(!s.knownByCharacterIds.includes(charMallisterId), 'Jason is not knownBy');
  });

  check('updateSecretKnowledge with action: learns moves character from suspectedBy to knownBy', () => {
    const updateRes = updateSecretKnowledge(storage, {
      secretId: secret15Id,
      characterId: 'Ser Jason Mallister',
      action: 'learns',
      note: 'Found the poisoned flagon in the pantry.',
    });
    assert(updateRes.success === true, 'updateSecretKnowledge succeeded');
    const s = storage.secrets.find((sec) => sec.id === secret15Id)!;
    assert(s.knownByCharacterIds.includes(charMallisterId), 'Character is now in knownByCharacterIds');
    assert(!s.suspectedByCharacterIds.includes(charMallisterId), 'Character was removed from suspectedByCharacterIds');
  });

  // 16. Anti-Metagaming Isolation
  console.log('\nTest 16: Anti-Metagaming Isolation (Epistemic Separation)');
  const charVymanRes = upsertCharacter(storage, { name: 'Maester Vyman', status: 'alive' });
  const charVymanId = charVymanRes.character.id;

  // Maester Vyman suspects the Poisoned Chalice Plot
  updateSecretKnowledge(storage, {
    secretId: secret15Id,
    characterId: charVymanId,
    action: 'suspects',
  });

  check('getCharacterKnowledge for suspecter conceals truth and exposes only publicCoverStory', () => {
    const knowRes = getCharacterKnowledge(storage, { characterId: charVymanId });
    assert(knowRes.success === true, 'getCharacterKnowledge succeeded');
    assert(knowRes.suspectsCount === 1, 'suspectsCount is 1');
    const suspectedItem = knowRes.suspects[0];
    assert(suspectedItem.title === 'Poisoned Chalice Plot', 'Suspected title matches');
    assert(suspectedItem.truth === undefined, 'Ground truth is strictly UNDEFINED for suspecter');
    assert(suspectedItem.publicCoverStory === 'Wine turned sour in the barrel.', 'Public cover story shown');
  });

  // 17. Secret Exposure Cascade
  console.log('\nTest 17: Secret Exposure Cascade');
  check('updateSecretKnowledge with action: exposes updates status, historyLog, and logs timeline event', () => {
    const initialTimelineCount = storage.timeline.length;
    const exposeRes = updateSecretKnowledge(storage, {
      secretId: secret15Id,
      characterId: charMallisterId,
      action: 'exposes',
      note: 'Jason produced the flagon before the Great Council.',
      autoLogTimelineEvent: true,
      date: '298 AC',
    });
    assert(exposeRes.success === true, 'Exposure succeeded');
    const s = storage.secrets.find((sec) => sec.id === secret15Id)!;
    assert(s.status === 'exposed', 'Secret status changed to exposed');
    assert(s.historyLog.some((h) => h.note.includes('Jason produced the flagon')), 'historyLog recorded exposure note');

    // Timeline cascade verification
    assert(storage.timeline.length === initialTimelineCount + 1, 'Timeline entry was created');
    const createdEvent = storage.timeline[storage.timeline.length - 1];
    assert(createdEvent.title.includes('Exposed: Poisoned Chalice Plot'), 'Event title matches');
    assert(createdEvent.tags.includes('Secret Exposure'), 'Event tagged Secret Exposure');
    assert(s.relatedEventIds.includes(createdEvent.id), 'Secret links to timeline event');
  });

  // 18. Public vs. Omniscient Search
  console.log('\nTest 18: Public vs. Omniscient Search Filtering');
  const secret18Res = upsertSecret(storage, {
    title: 'The Hidden Catacombs',
    truth: 'An underground tunnel connects the crypts to the Blackwater Rush with valyrianglyphs.',
    publicCoverStory: 'The old drains collapsed centuries ago.',
    severity: 'scandal',
    status: 'buried',
  });

  check('searchChronicle with includeSecrets: false hides buried secret', () => {
    const searchPublic = searchChronicle(storage, 'valyrianglyphs', { includeSecrets: false });
    assert(searchPublic.success === true, 'Public search succeeded');
    assert(searchPublic.results.secrets.length === 0, 'Buried secret not returned in public search');
  });

  check('searchChronicle with includeSecrets: true returns buried secret', () => {
    const searchOmni = searchChronicle(storage, 'valyrianglyphs', { includeSecrets: true });
    assert(searchOmni.success === true, 'Omniscient search succeeded');
    assert(searchOmni.results.secrets.length === 1, 'Buried secret returned in omniscient search');
    assert(
      (searchOmni.results.secrets[0] as any).title === 'The Hidden Catacombs' ||
      searchOmni.results.secrets[0].titleOrName === 'The Hidden Catacombs',
      'Found correct secret'
    );
  });

  // 19. Age Math Edge Cases
  console.log('\nTest 19: Age Math Edge Cases');
  check('attachComputedAge calculates correct age for alive character with currentSortYear', () => {
    const campWithYear = { ...storage.getActiveCampaign(), currentSortYear: 298 };
    const charAlive = { id: 'c1', name: 'Alive Char', status: 'alive' as const, birthYear: 260 };
    const enriched = attachComputedAge(charAlive, campWithYear);
    assert(enriched.computedAge === 38, `Expected age 38, got ${enriched.computedAge}`);
  });

  check('attachComputedAge calculates correct ageAtDeath for deceased character', () => {
    const campWithYear = { ...storage.getActiveCampaign(), currentSortYear: 298 };
    const charDead = { id: 'c2', name: 'Dead Char', status: 'dead' as const, birthYear: 220, deathYear: 265 };
    const enriched = attachComputedAge(charDead, campWithYear);
    assert(enriched.computedAge === 45, `Expected computedAge 45, got ${enriched.computedAge}`);
    assert(enriched.ageAtDeath === 45, `Expected ageAtDeath 45, got ${enriched.ageAtDeath}`);
  });

  check('attachComputedAge returns undefined (not NaN) when currentSortYear is absent', () => {
    const campNoYear = { ...storage.getActiveCampaign(), currentSortYear: undefined };
    const charAlive = { id: 'c3', name: 'No Year Char', status: 'alive' as const, birthYear: 260 };
    const enriched = attachComputedAge(charAlive, campNoYear);
    assert(enriched.computedAge === undefined, `Expected undefined, got ${enriched.computedAge}`);
    assert(!Number.isNaN(enriched.computedAge), 'computedAge is not NaN');
  });

  // 20. Intrigue Matrix Precision in getSceneBriefing
  console.log('\nTest 20: Intrigue Matrix Precision in getSceneBriefing');
  const charAliceRes = upsertCharacter(storage, { name: 'Lady Alice', status: 'alive' });
  const charAliceId = charAliceRes.character.id;

  const charBobRes = upsertCharacter(storage, { name: 'Lord Bob', status: 'alive' });
  const charBobId = charBobRes.character.id;

  const charCharlieRes = upsertCharacter(storage, {
    name: 'Ser Charlie',
    status: 'alive',
    activeGrudges: [
      {
        targetId: charAliceId,
        intensity: 'mortal',
        reason: 'Slain kin during the siege',
        date: '295 AC',
      },
    ],
  });
  const charCharlieId = charCharlieRes.character.id;

  // Secret 1: Alice knows truth about Bob (Bob is subject, Alice is knower)
  upsertSecret(storage, {
    title: 'Bob Embezzled the Treasury',
    truth: 'Bob diverted 10,000 gold dragons to Braavos.',
    publicCoverStory: 'Audited accounts were clean.',
    severity: 'treason',
    status: 'buried',
    subjectIds: [charBobId],
    knownByCharacterIds: [charAliceId],
    leverageNote: 'Alice holds signed receipts proving the theft.',
  });

  // Secret 2: Bob and Charlie share a secret conspiracy
  upsertSecret(storage, {
    title: 'The Silent Pact',
    truth: 'Bob and Charlie agreed to divide the borderlands upon the king death.',
    severity: 'scandal',
    status: 'buried',
    subjectIds: [charBobId, charCharlieId],
    knownByCharacterIds: [charBobId, charCharlieId],
  });

  const briefingRes = getSceneBriefing(storage, {
    characterIds: [charAliceId, charBobId, charCharlieId],
    povCharacterId: charBobId,
  });

  check('getSceneBriefing identifies activeLeverage of Alice over Bob', () => {
    assert(briefingRes.success === true, 'getSceneBriefing succeeded');
    const lev = briefingRes.intrigueMatrix.activeLeverage.find(
      (l: any) => l.holder === 'Lady Alice' && l.target === 'Lord Bob'
    );
    assert(lev !== undefined, 'Found Alice leverage over Bob');
    assert(lev.secretTitle === 'Bob Embezzled the Treasury', 'Leverage secret title matches');
  });

  check('getSceneBriefing identifies sharedConspiracies between Bob and Charlie', () => {
    const consp = briefingRes.intrigueMatrix.sharedConspiracies.find(
      (c: any) => c.title === 'The Silent Pact'
    );
    assert(consp !== undefined, 'Found shared conspiracy');
    assert(consp.conspirators.includes('Lord Bob') && consp.conspirators.includes('Ser Charlie'), 'Conspirators list Bob and Charlie');
  });

  check('getSceneBriefing sets gmGuardrail warning that POV Bob does not know Alice secret about him', () => {
    assert(briefingRes.intrigueMatrix.gmGuardrail !== undefined, 'gmGuardrail is set');
    assert(briefingRes.intrigueMatrix.gmGuardrail.includes('Bob Embezzled the Treasury'), 'gmGuardrail warns about unrevealed secret');
    assert(briefingRes.intrigueMatrix.gmGuardrail.includes('Lord Bob does NOT know'), 'Warns specifically for Lord Bob');
  });

  check('getSceneBriefing includes inRoomGrudges for Charlie against Alice', () => {
    const grudge = briefingRes.inRoomGrudges.find(
      (g: any) => g.holder === 'Ser Charlie' && g.target === 'Lady Alice'
    );
    assert(grudge !== undefined, 'Found grudge in room');
    assert(grudge.intensity === 'mortal', 'Grudge intensity matches');
    assert(grudge.reason.includes('Slain kin'), 'Grudge reason matches');
  });

  // 21. Payload Size Guardrail (< 12KB)
  console.log('\nTest 21: Payload Size Guardrail (< 12KB)');
  // Add 30 historyLog entries to Alice
  const bloatedAlice = storage.characters.find((c) => c.id === charAliceId)!;
  bloatedAlice.historyLog = [];
  for (let i = 1; i <= 30; i++) {
    bloatedAlice.historyLog.push({
      timestamp: Date.now() - i * 10000,
      date: `29${i % 10} AC`,
      note: `Detailed chronicle record #${i}: Great diplomatic envoy to the Free Cities detailing grain shipments, tariffs, military dispositions, and hostage exchanges.`,
    });
  }

  // Add 15 tomes
  for (let i = 1; i <= 15; i++) {
    upsertTome(storage, {
      title: `Grand Historical Codex Volume ${i}`,
      content: `Extensive multi-paragraph historical treatise #${i} recording ancient battles, heraldic lineages, dynastic marriages, and ancestral conflicts across the seven kingdoms with deep narrative lore.`,
      sourceType: 'letter',
      relatedCharacterIds: [charAliceId],
      reliability: 'biased',
    });
  }

  const guardrailBriefing = getSceneBriefing(storage, {
    characterIds: [charAliceId, charBobId],
    povCharacterId: charBobId,
  });

  check('getSceneBriefing compacts cast historyLog to maximum 2 entries', () => {
    const aliceInBriefing = guardrailBriefing.cast.find((c: any) => c.id === charAliceId);
    assert(aliceInBriefing !== undefined, 'Alice in briefing');
    assert(aliceInBriefing.historyLog.length <= 2, `History log truncated to <= 2 (was ${aliceInBriefing.historyLog.length})`);
  });

  check('getSceneBriefing limits localVoices to maximum 3 entries', () => {
    assert(guardrailBriefing.localVoices.length <= 3, `localVoices capped at <= 3 (was ${guardrailBriefing.localVoices.length})`);
  });

  check('getSceneBriefing total serialized payload is under 12 KB', () => {
    const payloadStr = JSON.stringify(guardrailBriefing);
    const payloadSize = Buffer.byteLength(payloadStr, 'utf-8');
    assert(payloadSize < 12288, `Payload size must be < 12KB (was ${payloadSize} bytes)`);
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
