import { z } from 'zod';

export interface Campaign {
  id: string;
  name: string;
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
  createdAt: number;
  updatedAt: number;
}

export interface TimelineEntry {
  id: string;
  campaignId: string;
  title: string;
  date?: string;             // in-game date, freeform string e.g. "1066 AD, Winter"
  tags: string[];            // character names / places involved
  narrative: string;
  mechanicalOutcome?: MechanicalOutcome;
  createdAt: number;
  updatedAt: number;
}

export interface Tome {
  id: string;
  campaignId: string;
  title: string;
  category?: string;         // e.g. "House History", "Mod Flavor", "Prophecy"
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
  createdAt: number;
  updatedAt: number;
}

// Zod schemas for Tool Inputs & Validations

export const CampaignSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Campaign name is required'),
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
  note: z.string().optional(),
  date: z.string().optional(),
});

export const TimelineEntrySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  date: z.string().optional(),
  tags: z.array(z.string()).default([]),
  narrative: z.string().min(1, 'Narrative is required'),
  mechanicalOutcome: MechanicalOutcomeSchema.optional(),
  campaignId: z.string().optional(),
});

export const TimelineUpdateSchema = z.object({
  title: z.string().optional(),
  date: z.string().optional(),
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
  note: z.string().optional(),
  date: z.string().optional(),
});
