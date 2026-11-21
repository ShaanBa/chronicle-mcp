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
  routeSkill,
  listSkills,
  getSkill,
} from '../src/tools/skills.js';
import { createChronicleServer } from '../src/index.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  loadAllSkills,
  getSkillById,
  countWords,
  DEFAULT_SKILLS_DIR,
  clearSkillCache,
  MAX_DESCRIPTION_WORDS,
  MAX_PLAYBOOK_WORDS,
} from '../src/skills/loader.js';
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

  async function checkAsync(description: string, fn: () => Promise<void>) {
    try {
      await fn();
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

  check('getSceneBriefing compacts cast historyLog to maximum 2 entries in recentHistory', () => {
    const aliceInBriefing = guardrailBriefing.cast.find((c: any) => c.id === charAliceId);
    assert(aliceInBriefing !== undefined, 'Alice in briefing');
    assert((aliceInBriefing.recentHistory || aliceInBriefing.historyLog).length <= 2, `History log truncated to <= 2 (was ${(aliceInBriefing.recentHistory || aliceInBriefing.historyLog).length})`);
  });

  check('getSceneBriefing limits localVoices to maximum 3 entries', () => {
    assert(guardrailBriefing.localVoices.length <= 3, `localVoices capped at <= 3 (was ${guardrailBriefing.localVoices.length})`);
  });

  check('getSceneBriefing total serialized payload is under 12 KB', () => {
    const payloadStr = JSON.stringify(guardrailBriefing);
    const payloadSize = Buffer.byteLength(payloadStr, 'utf-8');
    assert(payloadSize < 12288, `Payload size must be < 12KB (was ${payloadSize} bytes)`);
  });

  // 22. Skill Loader & Word-Budget Constraints
  console.log('\nTest 22: Skill Loader & Word-Budget Constraints');
  clearSkillCache();
  const allLoadedSkills = loadAllSkills();

  check('Skill loader loads exactly 8 core cartridges', () => {
    assert(allLoadedSkills.length === 8, `Expected 8 core skills, found ${allLoadedSkills.length}`);
  });

  check('All core skills have unique IDs and valid non-empty fields', () => {
    const ids = new Set<string>();
    for (const s of allLoadedSkills) {
      assert(!ids.has(s.id), `Duplicate skill id: ${s.id}`);
      ids.add(s.id);
      assert(s.name.length > 0, `Skill ${s.id} missing name`);
      assert(s.description.length > 0, `Skill ${s.id} missing description`);
      assert(s.triggers.length > 0, `Skill ${s.id} triggers is empty`);
      assert(s.toolSequence.length > 0, `Skill ${s.id} toolSequence is empty`);
      assert(s.playbook.length > 0, `Skill ${s.id} playbook is empty`);
    }
  });

  check(`All core skills obey description budget (<= ${MAX_DESCRIPTION_WORDS} words)`, () => {
    for (const s of allLoadedSkills) {
      const descWords = countWords(s.description);
      assert(
        descWords <= MAX_DESCRIPTION_WORDS,
        `Skill '${s.id}' description exceeds ${MAX_DESCRIPTION_WORDS} words (${descWords} words: "${s.description}")`
      );
    }
  });

  check(`All core skills obey playbook budget (<= ${MAX_PLAYBOOK_WORDS} words)`, () => {
    for (const s of allLoadedSkills) {
      const pbWords = countWords(s.playbook);
      assert(
        pbWords <= MAX_PLAYBOOK_WORDS,
        `Skill '${s.id}' playbook exceeds ${MAX_PLAYBOOK_WORDS} words (${pbWords} words)`
      );
    }
  });

  check('Skill loader gracefully handles malformed custom SKILL.md without throwing', () => {
    const tempBadDir = path.join(DEFAULT_SKILLS_DIR, 'custom', 'temp-invalid-test');
    if (!fs.existsSync(tempBadDir)) fs.mkdirSync(tempBadDir, { recursive: true });
    const tempBadFile = path.join(tempBadDir, 'SKILL.md');
    fs.writeFileSync(tempBadFile, 'Not valid frontmatter at all :::: {{}}', 'utf-8');
    try {
      clearSkillCache();
      const countBefore = allLoadedSkills.length;
      const countWithInvalid = loadAllSkills().length;
      assert(countWithInvalid === countBefore, 'Invalid skill was safely ignored');
    } finally {
      if (fs.existsSync(tempBadDir)) fs.rmSync(tempBadDir, { recursive: true, force: true });
      clearSkillCache();
    }
  });

  // 23. 10-Intent Accuracy Matrix
  console.log('\nTest 23: 10-Intent Accuracy Matrix');
  const intentMatrix: { intent: string; expectedSkill: string }[] = [
    {
      intent: 'starting a new chronicle, introduce the setting and establish our starting characters',
      expectedSkill: 'session-bootstrap',
    },
    {
      intent: "plotting to poison Lord Frey's wine at the feast and framing the maester",
      expectedSkill: 'court-intrigue',
    },
    {
      intent: 'holding peace parley with the ironborn envoys to negotiate a sacred alliance treaty',
      expectedSkill: 'diplomacy-and-oaths',
    },
    {
      intent: 'leading the vanguard in an open battlefield skirmish against the rebel army',
      expectedSkill: 'war-and-reckoning',
    },
    {
      intent: 'arranging a dynastic betrothal and calculating heir claims to the ancestral seat',
      expectedSkill: 'dynasty-and-succession',
    },
    {
      intent: 'listening to dockside rumors and smallfolk chatter over ale in the local tavern',
      expectedSkill: 'world-texture-and-tavern',
    },
    {
      intent: 'translating an ancient decaying maester scroll detailing valyrian steel forging',
      expectedSkill: 'maester-and-lore',
    },
    {
      intent: 'recap the scene consequences, record character deaths, and update the chronicle timeline',
      expectedSkill: 'post-scene-chronicle',
    },
    {
      intent: "whispering rumors in the queen's solar about the treasurer's embezzlement",
      expectedSkill: 'court-intrigue',
    },
    {
      intent: 'ordering a siege assault against the gatehouse with battering rams and archers',
      expectedSkill: 'war-and-reckoning',
    },
  ];

  for (const item of intentMatrix) {
    check(`Intent routing matches '${item.expectedSkill}': "${item.intent.slice(0, 45)}..."`, () => {
      const res = routeSkill(storage, { intent: item.intent, autoBrief: false });
      assert(res.success === true, 'routeSkill returned success');
      assert(
        res.primarySkill.id === item.expectedSkill,
        `Expected ${item.expectedSkill}, but got ${res.primarySkill.id} (score ${res.routingTrace.score})`
      );
    });
  }

  // 24. Direct @id Override
  console.log('\nTest 24: Direct @id Override');
  check('Direct @id override routes with score 1000 and suppresses secondary blend', () => {
    const overrideRes = routeSkill(storage, {
      intent: '@maester-and-lore examine the rusted dagger found in the tower',
      autoBrief: false,
    });
    assert(overrideRes.success === true, 'routeSkill succeeded');
    assert(overrideRes.primarySkill.id === 'maester-and-lore', 'Selected @maester-and-lore');
    assert(overrideRes.routingTrace.score === 1000, `Score must be 1000 (was ${overrideRes.routingTrace.score})`);
    assert(overrideRes.secondaryBlend === undefined, 'Secondary blend suppressed on direct override');
  });

  // 25. Live World-State Boost + Secondary Blend
  console.log('\nTest 25: Live World-State Boost + Secondary Blend');
  addRelationship(storage, {
    fromType: 'character',
    fromId: charAliceId,
    toType: 'character',
    toId: charBobId,
    type: 'rival',
    sentiment: -25,
  });

  check('Live world-state activates boosts and blends runner-up when within score threshold or secret heat >= 8', () => {
    const blendRes = routeSkill(storage, {
      intent: 'negotiate a marriage pact and alliance between families',
      characterIds: [charAliceId, charBobId],
      autoBrief: false,
      includeSecondary: true,
    });

    assert(blendRes.success === true, 'routeSkill succeeded');
    assert(blendRes.primarySkill.id === 'diplomacy-and-oaths', `Expected primary diplomacy-and-oaths, got ${blendRes.primarySkill.id}`);
    assert(blendRes.secondaryBlend !== undefined, 'secondaryBlend must be defined');
    assert(blendRes.secondaryBlend?.id === 'court-intrigue', `Expected blended court-intrigue, got ${blendRes.secondaryBlend?.id}`);
    assert(
      blendRes.secondaryBlend!.directives.length > 0 && blendRes.secondaryBlend!.directives.length <= 3,
      `Secondary directives must be 1-3 entries (got ${blendRes.secondaryBlend?.directives.length})`
    );
    assert(blendRes.routingTrace.worldStateBoosts.length > 0, 'World state boosts recorded in trace');
  });

  // 26. Auto-Prefetch Chaining
  console.log('\nTest 26: Auto-Prefetch Chaining');
  check('routeSkill with autoBrief: true prefetches sceneBriefing and protects against double-fetching', () => {
    const prefetchRes = routeSkill(storage, {
      intent: 'confronting Lord Bob in the solar about his embezzlement and treason',
      characterIds: [charAliceId, charBobId],
      autoBrief: true,
    });

    assert(prefetchRes.success === true, 'routeSkill succeeded');
    assert(prefetchRes.primarySkill.id === 'court-intrigue', `Expected court-intrigue, got ${prefetchRes.primarySkill.id}`);
    assert(prefetchRes.prefetchedContext !== undefined, 'prefetchedContext is attached');
    assert(prefetchRes.prefetchedContext?.sceneBriefing !== undefined, 'sceneBriefing is prefetched');
    assert(prefetchRes.prefetchedContext?.sceneBriefing.intrigueMatrix !== undefined, 'intrigueMatrix is inside prefetched sceneBriefing');
    assert(prefetchRes.prefetchNotice !== undefined, 'prefetchNotice is defined');
    assert(prefetchRes.prefetchNotice!.includes('ALREADY attached'), 'prefetchNotice warns against double-fetching');
    assert(
      !prefetchRes.remainingRecommendedTools.includes('get_scene_briefing'),
      'get_scene_briefing was safely removed from remainingRecommendedTools'
    );
  });

  // 27. Custom Campaign Scoping
  console.log('\nTest 27: Custom Campaign Scoping');
  const customSkillDir = path.join(DEFAULT_SKILLS_DIR, 'custom', 'test-valyria-prophecy');
  if (!fs.existsSync(customSkillDir)) fs.mkdirSync(customSkillDir, { recursive: true });
  const customSkillPath = path.join(customSkillDir, 'SKILL.md');

  const customSkillContent = `---
id: test-valyria-prophecy
name: Valyrian Prophecy & Omens
description: Interpreting blood prophecies and doom visions for Valyrian dragonlords.
priority: 9
triggers:
  - "dragon dream"
  - "doom prophecy"
  - "blood magic"
campaignScope:
  - "Valyria"
  - "campaign-valyria-test"
toolSequence:
  - get_scene_briefing
  - upsert_tome
---

## Mode Directives
* Treat dreams as literal or figurative doom omens.
* Involve ancient high Valyrian glyphs.
* Herald the coming cataclysm.

## Voice & Flavor Rules
* Smelling of sulfur, ash, and obsidian.

## Mandatory State Updates
* Record all ominous prophecies in tomes.
`;

  try {
    fs.writeFileSync(customSkillPath, customSkillContent, 'utf-8');
    clearSkillCache();

    check('Custom skill is hidden from listSkills in standard/unmatched campaigns', () => {
      const skillsInBritannia = listSkills(storage).skills;
      const found = skillsInBritannia.find((s) => s.id === 'test-valyria-prophecy');
      assert(found === undefined, 'test-valyria-prophecy must be hidden outside Valyria');
    });

    check('Custom skill is visible with includeAllCampaigns: true', () => {
      const allSkills = listSkills(storage, { includeAllCampaigns: true }).skills;
      const found = allSkills.find((s) => s.id === 'test-valyria-prophecy');
      assert(found !== undefined, 'test-valyria-prophecy must appear with includeAllCampaigns: true');
    });

    const valyriaRes = createCampaign(storage, 'Valyria');
    const valyriaCampId = valyriaRes.campaign.id;

    check('Custom skill is visible in matching campaign scope', () => {
      const valyriaSkills = listSkills(storage, { campaignId: valyriaCampId }).skills;
      const found = valyriaSkills.find((s) => s.id === 'test-valyria-prophecy');
      assert(found !== undefined, 'test-valyria-prophecy must be visible in Valyria campaign');
    });

    check('Custom skill routes successfully within matching campaign scope', () => {
      const routed = routeSkill(storage, {
        intent: 'interpreting an ominous dragon dream and doom prophecy',
        campaignId: valyriaCampId,
        autoBrief: false,
      });
      assert(routed.success === true, 'routeSkill succeeded');
      assert(routed.primarySkill.id === 'test-valyria-prophecy', `Expected test-valyria-prophecy, got ${routed.primarySkill.id}`);
    });

    check('Custom skill is NOT routed when outside matching campaign scope', () => {
      const routedOutside = routeSkill(storage, {
        intent: 'interpreting an ominous dragon dream and doom prophecy',
        autoBrief: false,
      });
      assert(routedOutside.success === true, 'routeSkill succeeded');
      assert(
        routedOutside.primarySkill.id !== 'test-valyria-prophecy',
        'Scoped skill must not route outside its campaign'
      );
    });
  } finally {
    if (fs.existsSync(customSkillDir)) {
      fs.rmSync(customSkillDir, { recursive: true, force: true });
    }
    clearSkillCache();
  }

  // 28. Partial-Update Data Preservation
  console.log('\nTest 28: Partial-Update Data Preservation & Transient Field Stripping');
  const raymundP0Res = upsertCharacter(storage, {
    name: 'Lord Raymund P0',
    house: 'House Mooton',
    tags: ['OriginalTag1', 'OriginalTag2'],
    titles: ['Lord of Maidenpool'],
    traits: ['Proud', 'Cautious'],
    status: 'alive',
  });
  const raymundP0Id = raymundP0Res.character.id;

  // Partial update omitting tags, titles, traits
  const raymundUpdateRes = upsertCharacter(storage, {
    id: raymundP0Id,
    name: 'Lord Raymund P0',
    currentObsession: 'Securing the Harbor Fort',
    note: 'Transient milestone note',
    date: '298 AC',
  });

  check('upsertCharacter partial update preserves existing tags, titles, and traits', () => {
    assert(raymundUpdateRes.success === true, 'Update succeeded');
    const c = storage.characters.find((char) => char.id === raymundP0Id)!;
    assert(c.tags.includes('OriginalTag1') && c.tags.includes('OriginalTag2'), 'Tags preserved');
    assert(c.titles.includes('Lord of Maidenpool'), 'Titles preserved');
    assert(c.traits.includes('Proud'), 'Traits preserved');
    assert(c.currentObsession === 'Securing the Harbor Fort', 'Obsession updated');
    assert((c as any).note === undefined, 'Transient note stripped from character record');
    assert((c as any).date === undefined, 'Transient date stripped from character record');
    assert(c.historyLog.some((h) => h.note.includes('Transient milestone note')), 'Note recorded in historyLog');
  });

  // House partial update
  const mootonRes = upsertHouse(storage, {
    name: 'House Mooton',
    holdings: ['Maidenpool Castle', 'Harbor Watchtower'],
    tags: ['Riverlands', 'Merchant'],
    words: 'Wisdom and Strength',
  });
  const mootonId = mootonRes.house.id;

  const mootonUpdateRes = upsertHouse(storage, {
    id: mootonId,
    name: 'House Mooton',
    prestige: 150,
    note: 'Prestige elevation',
  });

  check('upsertHouse partial update preserves holdings and tags without wiping to []', () => {
    assert(mootonUpdateRes.success === true, 'House update succeeded');
    const h = storage.houses.find((house) => house.id === mootonId)!;
    assert(h.holdings.includes('Maidenpool Castle'), 'Holdings preserved');
    assert(h.tags.includes('Merchant'), 'Tags preserved');
    assert(h.words === 'Wisdom and Strength', 'Words preserved');
    assert(h.prestige === 150, 'Prestige updated');
    assert((h as any).note === undefined, 'Transient note stripped');
  });

  // Secret partial update
  const secretPartRes = upsertSecret(storage, {
    title: 'The Smuggler Guild',
    truth: 'Smugglers use the sea gate at night.',
    severity: 'treason',
    status: 'buried',
    subjectIds: [raymundP0Id],
    knownByCharacterIds: [charAliceId],
    tags: ['Contraband', 'Smuggling'],
  });
  const secretPartId = secretPartRes.secret.id;

  const secretUpdateRes = upsertSecret(storage, {
    id: secretPartId,
    title: 'The Smuggler Guild',
    truth: 'Smugglers use the sea gate at night.',
    status: 'whispered',
    note: 'Rumors spread to the docks.',
  });

  check('upsertSecret partial update preserves knownByCharacterIds and tags', () => {
    assert(secretUpdateRes.success === true, 'Secret update succeeded');
    const s = storage.secrets.find((sec) => sec.id === secretPartId)!;
    assert(s.knownByCharacterIds.includes(charAliceId), 'knownByCharacterIds preserved');
    assert(s.tags.includes('Contraband'), 'Tags preserved');
    assert(s.status === 'whispered', 'Status updated');
    assert((s as any).note === undefined, 'Transient note stripped');
  });

  // 29. MCP Tool Schema Parity
  console.log('\nTest 29: MCP Tool Schema Parity in createChronicleServer');
  const testMcpServer = createChronicleServer(storage);
  await checkAsync('createChronicleServer registers tools with correct Phase 1 & 2 schemas', async () => {
    const handlers = (testMcpServer as any)._requestHandlers;
    const listToolsHandler = handlers?.get(ListToolsRequestSchema.shape.method.value);
    assert(listToolsHandler !== undefined, 'ListTools handler registered');
    const res = await listToolsHandler({ method: 'tools/list' });
    const registeredTools = res.tools;

    // Check log_timeline_event mechanicalOutcome is object
    const timelineTool = registeredTools.find((t: any) => t.name === 'log_timeline_event');
    assert(timelineTool !== undefined, 'log_timeline_event tool found');
    const outcomeSchema = timelineTool.inputSchema.properties.entry.properties.mechanicalOutcome;
    assert(outcomeSchema.type === 'object', `mechanicalOutcome must be object (was ${outcomeSchema.type})`);
    assert(outcomeSchema.properties.summary !== undefined, 'mechanicalOutcome has summary');

    // Check upsert_character has Phase 1/2 fields and no phantom fields
    const charTool = registeredTools.find((t: any) => t.name === 'upsert_character');
    assert(charTool !== undefined, 'upsert_character tool found');
    const charProps = charTool.inputSchema.properties.character.properties;
    assert(charProps.traits !== undefined, 'traits in upsert_character schema');
    assert(charProps.activeGrudges !== undefined, 'activeGrudges in upsert_character schema');
    assert(charProps.currentObsession !== undefined, 'currentObsession in upsert_character schema');
    assert(charProps.born === undefined, 'phantom field born removed');
    assert(charProps.summary === undefined, 'phantom field summary removed');

    // Check upsert_house uses words, sigil, seat, not motto/coatOfArms
    const houseTool = registeredTools.find((t: any) => t.name === 'upsert_house');
    assert(houseTool !== undefined, 'upsert_house tool found');
    const houseProps = houseTool.inputSchema.properties.house.properties;
    assert(houseProps.words !== undefined, 'words in upsert_house schema');
    assert(houseProps.sigil !== undefined, 'sigil in upsert_house schema');
    assert(houseProps.seat !== undefined, 'seat in upsert_house schema');
    assert(houseProps.motto === undefined, 'obsolete motto removed');
    assert(houseProps.coatOfArms === undefined, 'obsolete coatOfArms removed');

    // Check add_relationship has isSecret, sentiment, publicFacade, oneWay
    const relTool = registeredTools.find((t: any) => t.name === 'add_relationship');
    assert(relTool !== undefined, 'add_relationship tool found');
    const relProps = relTool.inputSchema.properties;
    assert(relProps.isSecret !== undefined, 'isSecret in add_relationship schema');
    assert(relProps.sentiment !== undefined, 'sentiment in add_relationship schema');
    assert(relProps.publicFacade !== undefined, 'publicFacade in add_relationship schema');
    assert(relProps.oneWay !== undefined, 'oneWay in add_relationship schema');
  });

  // 30. House-to-House Relationship Isolation in Scene Briefing
  console.log('\nTest 30: House-to-House Relationship Isolation in Scene Briefing');
  const houseStarkRes = upsertHouse(storage, { name: 'House Stark of Winterfell', words: 'Winter is Coming' });
  const houseLannisterRes = upsertHouse(storage, { name: 'House Lannister of Casterly Rock', words: 'Hear Me Roar' });
  const houseMartellRes = upsertHouse(storage, { name: 'House Martell of Sunspear', words: 'Unbowed, Unbent, Unbroken' });
  const houseTyrellRes = upsertHouse(storage, { name: 'House Tyrell of Highgarden', words: 'Growing Strong' });

  addRelationship(storage, {
    fromType: 'house',
    fromId: houseStarkRes.house.id,
    toType: 'house',
    toId: houseLannisterRes.house.id,
    type: 'enemy',
    note: 'Blood feud since the execution of Ned Stark',
  });

  addRelationship(storage, {
    fromType: 'house',
    fromId: houseMartellRes.house.id,
    toType: 'house',
    toId: houseTyrellRes.house.id,
    type: 'rival',
    note: 'Ancient Reach-Dorne border skirmishes',
  });

  const starkChar = upsertCharacter(storage, { name: 'Robb Stark', house: houseStarkRes.house.name });
  const lannisterChar = upsertCharacter(storage, { name: 'Jaime Lannister', house: houseLannisterRes.house.name });

  check('getSceneBriefing only includes house relationships for dynasties present in the room', () => {
    const briefing = getSceneBriefing(storage, {
      characterIds: [starkChar.character.id, lannisterChar.character.id],
    });

    const houseRels = briefing.inRoomRelationships.filter((r: any) =>
      r.from.includes('Stark') || r.to.includes('Stark') || r.from.includes('Lannister') || r.to.includes('Lannister')
    );
    assert(houseRels.length > 0, 'Stark-Lannister house relationship included');

    const unrelatedRels = briefing.inRoomRelationships.filter((r: any) =>
      r.from.includes('Martell') || r.to.includes('Martell') || r.from.includes('Tyrell') || r.to.includes('Tyrell')
    );
    assert(unrelatedRels.length === 0, `Unrelated Martell-Tyrell house edges leaked (found ${unrelatedRels.length})`);
  });

  // 31. Secret Inverse Edge Mirroring & Maester Mode Hiding
  console.log('\nTest 31: Secret Inverse Edge Mirroring & Maester Mode Hiding');
  const secretRelCharA = upsertCharacter(storage, { name: 'Daeron Blackfyre' }).character.id;
  const secretRelCharB = upsertCharacter(storage, { name: 'Daemon Rivers' }).character.id;

  addRelationship(storage, {
    fromType: 'character',
    fromId: secretRelCharA,
    toType: 'character',
    toId: secretRelCharB,
    type: 'ally',
    isSecret: true,
    sentiment: 40,
    publicFacade: 'Vicious rivals',
    note: 'Secretly plotting a joint rebellion',
  });

  check('Inverse edge mirrors isSecret and is hidden in Maester Mode (includeSecrets: false)', () => {
    // List for B (the target of the forward edge) in Maester Mode
    const maesterB = listRelationships(storage, 'character', secretRelCharB, false);
    assert(maesterB.relationships.length === 0, `Inverse edge leaked in Maester mode (found ${maesterB.relationships.length})`);

    // List for B in Omniscient Mode
    const omniscientB = listRelationships(storage, 'character', secretRelCharB, true);
    assert(omniscientB.relationships.length === 1, 'Inverse edge visible in Omniscient mode');
    assert(omniscientB.relationships[0].isSecret === true, 'Inverse edge has isSecret: true');
    assert(omniscientB.relationships[0].sentiment === 40, 'Inverse edge has sentiment: 40');
    assert(omniscientB.relationships[0].publicFacade === 'Vicious rivals', 'Inverse edge has publicFacade');
  });

  // 32. Exposed Secrets Excluded from gmGuardrail and activeLeverage
  console.log('\nTest 32: Exposed Secrets Excluded from gmGuardrail and activeLeverage');
  const exposedSecretRes = upsertSecret(storage, {
    title: 'The Queen Mother Poisoned the King',
    truth: 'Nightshade in the mulled wine',
    status: 'exposed',
    severity: 'treason',
    subjectIds: [starkChar.character.id],
    knownByCharacterIds: [starkChar.character.id],
    leverageNote: 'Execution if proven',
  });

  const buriedSecretRes = upsertSecret(storage, {
    title: 'Stark Golden Vault Key',
    truth: 'Hidden in Robb boots',
    status: 'buried',
    severity: 'scandal',
    subjectIds: [starkChar.character.id],
    knownByCharacterIds: [starkChar.character.id],
    leverageNote: 'Stark treasury access',
  });

  check('Exposed secrets are excluded from getSceneBriefing gmGuardrail leverage and blind spots', () => {
    const briefing = getSceneBriefing(storage, {
      characterIds: [starkChar.character.id, lannisterChar.character.id],
      povCharacterId: lannisterChar.character.id,
    });

    const matrix = briefing.intrigueMatrix;
    assert(matrix !== undefined, 'intrigueMatrix is attached');
    assert(matrix.gmGuardrail !== undefined, 'gmGuardrail is attached for buried secret');
    assert(matrix.gmGuardrail.includes('Stark Golden Vault Key'), 'Buried secret is in gmGuardrail');
    assert(!matrix.gmGuardrail.includes('The Queen Mother Poisoned the King'), 'Exposed secret is NOT in gmGuardrail');

    const leverageMatches = matrix.activeLeverage.filter((l: any) => l.secretTitle === 'The Queen Mother Poisoned the King');
    assert(leverageMatches.length === 0, 'Exposed secret must not appear in activeLeverage');

    const blindSpotMatches = matrix.hiddenBlindSpots.filter((b: any) => b.title === 'The Queen Mother Poisoned the King');
    assert(blindSpotMatches.length === 0, 'Exposed secret must not appear in hiddenBlindSpots');
  });

  // 33. route_skill Without characterIds Keeps get_scene_briefing in Recommended Tools
  console.log('\nTest 33: route_skill Without characterIds Behavior');
  check('routeSkill without characterIds does not prefetch sceneBriefing and keeps get_scene_briefing in tools', () => {
    const res = routeSkill(storage, {
      intent: 'plotting murder and blackmail against the council',
      autoBrief: true,
    });

    assert(res.success === true, 'routeSkill succeeded');
    assert(res.primarySkill.id === 'court-intrigue', `Expected court-intrigue, got ${res.primarySkill.id}`);
    assert(res.prefetchedContext?.sceneBriefing === undefined, 'sceneBriefing must NOT be prefetched without characterIds');
    assert(
      res.remainingRecommendedTools.includes('get_scene_briefing'),
      'get_scene_briefing must remain in remainingRecommendedTools when not prefetched'
    );
    assert(res.prefetchNotice !== undefined, 'prefetchNotice must be set');
    assert(res.prefetchNotice!.includes('No characterIds provided'), 'prefetchNotice informs user to call get_scene_briefing once participants are known');
  });

  // 34. subjectsInRoom precision: House-specific secrets don't falsely implicate other nobles
  console.log('\nTest 34: subjectsInRoom precision — House Stark secret must NOT implicate Jaime Lannister');
  const houseStarkSecret = upsertSecret(storage, {
    title: 'The Stark Direwolf Prophecy',
    truth: 'A secret known only to Stark blood',
    status: 'buried',
    severity: 'scandal',
    subjectIds: [houseStarkRes.house.id],
    knownByCharacterIds: [],
    suspectedByCharacterIds: [],
  });

  check('Jaime Lannister is NOT listed as a subject of a House Stark secret in scene briefing', () => {
    const briefing = getSceneBriefing(storage, {
      characterIds: [starkChar.character.id, lannisterChar.character.id],
      includeOmniscientSecrets: true,
    });

    const matrix = briefing.intrigueMatrix;
    const lannisterAsSubject = (matrix.activeLeverage || []).filter(
      (l: any) => l.target === 'Jaime Lannister' && l.secretTitle === 'The Stark Direwolf Prophecy'
    );
    assert(lannisterAsSubject.length === 0, `Jaime Lannister must NOT be a subject of a Stark-only secret (found ${lannisterAsSubject.length})`);

    const robbAsSubject = (matrix.hiddenBlindSpots || []).filter(
      (b: any) => b.title === 'The Stark Direwolf Prophecy'
    );
    // The secret has no knowers in the room, Robb is a subject via House Stark, so it appears as a blind spot
    assert(robbAsSubject.length > 0, 'Robb Stark (via House Stark) should appear as a blind spot subject');
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
