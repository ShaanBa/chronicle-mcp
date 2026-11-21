import { z } from 'zod';

export interface RealmMood {
  atmosphere: string;                  // Sensory/emotional mood of the realm right now
  stability: 'stable' | 'uneasy' | 'volatile' | 'fracturing';
  seasonOrWeather?: string;            // e.g. "Bitter Autumn Rains", "False Spring"
  activeCrises: string[];              // Ongoing pressures: famine, debt, war, heresy
  smallfolkWhispers: string[];         // 2-5 current tavern rumors (replace as eras shift)
}

export interface Campaign {
  id: string;
  name: string;
  setting?: string;                    // e.g. "Westeros - AGoT", "1066 Horn of Africa"
  currentDate?: string;                // Display date, e.g. "289 AC, Late Autumn"
  currentSortYear?: number;            // Numeric year anchor for age & timeline math
  currentEra?: string;                 // e.g. "The Long Regency"
  playerCharacterId?: string;          // Active POV ruler/character
  realmMood?: RealmMood;
  createdAt: number;
  lastActiveAt: number;
}

export interface HistoryLogEntry {
  timestamp: number;
  date?: string; // in-game date, e.g. "1066 AD, Winter"
  note: string;
}

export interface MechanicalOutcome {
  summary: string;           // e.g. "Won defensive Tyranny War: +200 prestige, no gold gained"
  goldDelta?: number;
  prestigeDelta?: number;
  pietyDelta?: number;
  territoryChange?: string;
  casualties?: string;
}

export interface FormativeScar {
  eventId?: string;                    // Optional link to TimelineEntry.id
  summary: string;                     // e.g. "Watched his brother burn at the Battle of the Ford"
}

export interface CharacterGrudge {
  targetId: string;                    // Character or House ID
  reason: string;                      // Specific slight they haven't forgiven
  date?: string;                       // When the slight occurred
  intensity?: 'petty' | 'bitter' | 'blood_oath';
}

export interface Character {
  id: string;
  campaignId: string;
  name: string;
  house?: string;
  status: 'alive' | 'dead' | 'unknown';
  tags: string[];
  face?: string;            // Face & Bearing
  voice?: string;
  coreDrive?: string;
  flaw?: string;             // Fatal Flaw
  modernAnalogue?: string;
  relationships?: string;    // freeform relationship map
  trajectory?: string;       // Likely Trajectory / latest summary
  historyLog: HistoryLogEntry[];
  epithet?: string;                    // e.g. "the Quiet", "Oathbreaker"
  titles?: string[];                   // e.g. ["Lord of Maidenpool", "Master of Coin"]
  birthYear?: number;                  // Numeric year matching Campaign.currentSortYear
  deathYear?: number;
  causeOfDeath?: string;
  culture?: string;
  religion?: string;
  traits?: string[];                   // Mechanical/archetypal traits: ["Arbitrary", "Deceitful", "Zealous"]
  speechTells?: string;                // Micro-cue: "Never uses contractions; taps signet ring when lying"
  currentObsession?: string;           // What they want *this year* (distinct from lifelong coreDrive)
  formativeScars?: FormativeScar[];    // 1-3 defining past traumas/triumphs
  activeGrudges?: CharacterGrudge[];   // Specific simmering resentments
  computedAge?: number;                // Computed on read: currentSortYear - birthYear
  ageAtDeath?: number;                 // Computed on read: deathYear - birthYear
  createdAt: number;
  updatedAt: number;
}

export interface TimelineEntry {
  id: string;
  campaignId: string;
  title: string;
  date?: string;             // in-game date, freeform string e.g. "1066 AD, Winter"
  sortYear?: number;         // Optional numeric year for accurate chronological sorting
  tags: string[];            // character names / places involved
  narrative: string;
  mechanicalOutcome?: MechanicalOutcome;
  createdAt: number;
  updatedAt: number;
}

export type TomeSourceType =
  | 'chronicle'
  | 'letter'
  | 'ballad'
  | 'rumor'
  | 'prophecy'
  | 'decree'
  | 'epitaph'
  | 'treatise'
  | 'mod_flavor';

export type TomeReliability =
  | 'true'
  | 'biased'
  | 'propaganda'
  | 'myth'
  | 'forged';

export interface Tome {
  id: string;
  campaignId: string;
  title: string;
  category?: string;         // e.g. "House History", "Mod Flavor", "Prophecy"
  sourceType?: TomeSourceType;
  inWorldAuthor?: string;    // e.g. "Maester Corwyn", "Maidenpool Dockhands"
  inGameDate?: string;       // When this document was written/sung
  reliability?: TomeReliability;
  relatedCharacterIds?: string[];
  relatedEventIds?: string[];
  tags: string[];
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface RelationshipEdge {
  id: string;
  campaignId: string;
  pairId: string;            // links forward & inverse edges
  fromType: 'character' | 'house';
  fromId: string;
  toType: 'character' | 'house';
  toId: string;
  type: 'ally' | 'rival' | 'spouse' | 'parent' | 'child' | 'sibling' | 'liege' | 'vassal' | 'enemy' | 'debtor' | 'creditor' | 'other';
  note?: string;
  isSecret?: boolean;                  // e.g. secret lover, hidden rival, covert debtor
  sentiment?: number;                  // Optional -100 to +100
  publicFacade?: string;               // e.g. "Polite vassal" while type is "enemy"
  createdAt: number;
}

export interface Thread {
  id: string;
  campaignId: string;
  title: string;
  status: 'open' | 'resolved' | 'dormant';
  summary: string;
  relatedCharacterIds: string[];
  relatedEventIds: string[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface House {
  id: string;
  campaignId: string;
  name: string;
  headCharacterId?: string;
  status: 'ruling' | 'vassal' | 'extinct' | 'rival' | 'unknown';
  holdings?: string[];
  prestige?: number;
  tags: string[];
  historyLog: HistoryLogEntry[];
  words?: string;                      // House motto/creed
  sigil?: string;                      // Heraldry & colors for sensory scene descriptions
  seat?: string;                       // Primary ancestral seat
  culture?: string;
  religion?: string;
  reputation?: string;                 // How other houses perceive them
  cadetOfHouseId?: string;             // Links cadet branches to parent dynasty
  createdAt: number;
  updatedAt: number;
}

export interface Secret {
  id: string;
  campaignId: string;
  title: string;                       // Short handle, e.g. "Perwyn's True Killer"
  truth: string;                       // Objective ground truth
  publicCoverStory?: string;           // Official narrative believed by the realm
  severity: 'gossip' | 'scandal' | 'treason' | 'dynasty_ending';
  status: 'buried' | 'whispered' | 'exposed' | 'discredited';
  subjectIds: string[];                // Character or House IDs implicated/affected
  knownByCharacterIds: string[];       // Characters with proof or direct knowledge
  suspectedByCharacterIds: string[];   // Characters who have partial clues or suspicions
  leverageNote?: string;               // Concrete fallout if exposed
  relatedEventIds: string[];           // Links to TimelineEntry IDs
  tags: string[];
  historyLog: HistoryLogEntry[];       // Tracks leaks, cover-ups, and exposure
  createdAt: number;
  updatedAt: number;
}

// Zod schemas for Tool Inputs & Validations

export const RealmMoodSchema = z.object({
  atmosphere: z.string().min(1),
  stability: z.enum(['stable', 'uneasy', 'volatile', 'fracturing']).default('uneasy'),
  seasonOrWeather: z.string().optional(),
  activeCrises: z.array(z.string()).default([]),
  smallfolkWhispers: z.array(z.string()).default([]),
});

export const CampaignPulseUpdateSchema = z.object({
  campaignId: z.string().optional(),
  setting: z.string().optional(),
  currentDate: z.string().optional(),
  currentSortYear: z.number().optional(),
  currentEra: z.string().optional(),
  playerCharacterId: z.string().optional(),
  realmMood: RealmMoodSchema.partial().optional(),
  addWhisper: z.string().optional(),     // Convenience: append a single rumor
  retireWhisper: z.string().optional(),  // Convenience: remove an outdated rumor
  addCrisis: z.string().optional(),
  resolveCrisis: z.string().optional(),
});

export const CampaignSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Campaign name is required'),
  setting: z.string().optional(),
  currentDate: z.string().optional(),
  currentSortYear: z.number().optional(),
  currentEra: z.string().optional(),
  playerCharacterId: z.string().optional(),
  realmMood: RealmMoodSchema.optional(),
});

export const HistoryLogEntrySchema = z.object({
  timestamp: z.number().optional(),
  date: z.string().optional(),
  note: z.string().min(1, 'Note is required'),
});

export const MechanicalOutcomeSchema = z.object({
  summary: z.string().min(1, 'Summary is required'),
  goldDelta: z.number().optional(),
  prestigeDelta: z.number().optional(),
  pietyDelta: z.number().optional(),
  territoryChange: z.string().optional(),
  casualties: z.string().optional(),
});

export const FormativeScarSchema = z.object({
  eventId: z.string().optional(),
  summary: z.string().min(1, 'Scar summary is required'),
});

export const CharacterGrudgeSchema = z.object({
  targetId: z.string().min(1, 'Target ID is required'),
  reason: z.string().min(1, 'Grudge reason is required'),
  date: z.string().optional(),
  intensity: z.enum(['petty', 'bitter', 'blood_oath']).default('bitter'),
});

export const CharacterSchema = z.object({
  id: z.string().optional(),
  campaignId: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  house: z.string().optional(),
  status: z.enum(['alive', 'dead', 'unknown']).default('alive'),
  tags: z.array(z.string()).default([]),
  face: z.string().optional(),
  voice: z.string().optional(),
  coreDrive: z.string().optional(),
  flaw: z.string().optional(),
  modernAnalogue: z.string().optional(),
  relationships: z.string().optional(),
  trajectory: z.string().optional(),
  historyLog: z.array(HistoryLogEntrySchema).optional(),
  epithet: z.string().optional(),
  titles: z.array(z.string()).default([]),
  birthYear: z.number().optional(),
  deathYear: z.number().optional(),
  causeOfDeath: z.string().optional(),
  culture: z.string().optional(),
  religion: z.string().optional(),
  traits: z.array(z.string()).default([]),
  speechTells: z.string().optional(),
  currentObsession: z.string().optional(),
  formativeScars: z.array(FormativeScarSchema).default([]),
  activeGrudges: z.array(CharacterGrudgeSchema).default([]),
  note: z.string().optional(),
  date: z.string().optional(),
});

export const TimelineEntrySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  date: z.string().optional(),
  sortYear: z.number().optional(),
  tags: z.array(z.string()).default([]),
  narrative: z.string().min(1, 'Narrative is required'),
  mechanicalOutcome: MechanicalOutcomeSchema.optional(),
  campaignId: z.string().optional(),
});

export const TimelineUpdateSchema = z.object({
  title: z.string().optional(),
  date: z.string().optional(),
  sortYear: z.number().optional(),
  tags: z.array(z.string()).optional(),
  narrative: z.string().optional(),
  mechanicalOutcome: MechanicalOutcomeSchema.optional(),
  campaignId: z.string().optional(),
});

export const TomeSchema = z.object({
  id: z.string().optional(),
  campaignId: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  category: z.string().optional(),
  sourceType: z.enum([
    'chronicle', 'letter', 'ballad', 'rumor', 'prophecy',
    'decree', 'epitaph', 'treatise', 'mod_flavor'
  ]).default('chronicle'),
  inWorldAuthor: z.string().optional(),
  inGameDate: z.string().optional(),
  reliability: z.enum(['true', 'biased', 'propaganda', 'myth', 'forged']).default('true'),
  relatedCharacterIds: z.array(z.string()).default([]),
  relatedEventIds: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  content: z.string().min(1, 'Content is required'),
});

export const RelationshipEdgeSchema = z.object({
  fromType: z.enum(['character', 'house']),
  fromId: z.string().min(1, 'fromId is required'),
  toType: z.enum(['character', 'house']),
  toId: z.string().min(1, 'toId is required'),
  type: z.enum([
    'ally', 'rival', 'spouse', 'parent', 'child', 'sibling', 
    'liege', 'vassal', 'enemy', 'debtor', 'creditor', 'other'
  ]),
  note: z.string().optional(),
  campaignId: z.string().optional(),
  isSecret: z.boolean().optional(),
  sentiment: z.number().min(-100).max(100).optional(),
  publicFacade: z.string().optional(),
  oneWay: z.boolean().optional(),
});

export const ThreadSchema = z.object({
  id: z.string().optional(),
  campaignId: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  status: z.enum(['open', 'resolved', 'dormant']).default('open'),
  summary: z.string().min(1, 'Summary is required'),
  relatedCharacterIds: z.array(z.string()).default([]),
  relatedEventIds: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export const HouseSchema = z.object({
  id: z.string().optional(),
  campaignId: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  headCharacterId: z.string().optional(),
  status: z.enum(['ruling', 'vassal', 'extinct', 'rival', 'unknown']).default('ruling'),
  holdings: z.array(z.string()).default([]),
  prestige: z.number().optional(),
  tags: z.array(z.string()).default([]),
  historyLog: z.array(HistoryLogEntrySchema).optional(),
  words: z.string().optional(),
  sigil: z.string().optional(),
  seat: z.string().optional(),
  culture: z.string().optional(),
  religion: z.string().optional(),
  reputation: z.string().optional(),
  cadetOfHouseId: z.string().optional(),
  note: z.string().optional(),
  date: z.string().optional(),
});

export const SecretSchema = z.object({
  id: z.string().optional(),
  campaignId: z.string().optional(),
  title: z.string().min(1, 'Secret title is required'),
  truth: z.string().min(1, 'Ground truth is required'),
  publicCoverStory: z.string().optional(),
  severity: z.enum(['gossip', 'scandal', 'treason', 'dynasty_ending']).default('scandal'),
  status: z.enum(['buried', 'whispered', 'exposed', 'discredited']).default('buried'),
  subjectIds: z.array(z.string()).default([]),
  knownByCharacterIds: z.array(z.string()).default([]),
  suspectedByCharacterIds: z.array(z.string()).default([]),
  leverageNote: z.string().optional(),
  relatedEventIds: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  note: z.string().optional(),         // Optional historyLog append note
  date: z.string().optional(),
});
