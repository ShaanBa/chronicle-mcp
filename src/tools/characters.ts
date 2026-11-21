import { Storage, generateId } from '../storage.js';
import { Character, CharacterSchema, HistoryLogEntry } from '../schema.js';
import { z } from 'zod';

export function listCharacters(
  storage: Storage,
  filter?: { status?: string; house?: string; tag?: string }
) {
  const activeId = storage.activeCampaignId;
  let chars = storage.characters.filter((c) => c.campaignId === activeId);

  if (filter?.status) {
    const statusLower = filter.status.toLowerCase();
    chars = chars.filter((c) => c.status.toLowerCase() === statusLower);
  }

  if (filter?.house) {
    const houseLower = filter.house.toLowerCase();
    chars = chars.filter((c) => c.house && c.house.toLowerCase().includes(houseLower));
  }

  if (filter?.tag) {
    const tagLower = filter.tag.toLowerCase();
    chars = chars.filter((c) => c.tags.some((t) => t.toLowerCase() === tagLower));
  }

  const summaries = chars.map((c) => ({
    id: c.id,
    campaignId: c.campaignId,
    name: c.name,
    house: c.house,
    status: c.status,
    tags: c.tags,
    historyCount: (c.historyLog || []).length,
  }));

  return {
    success: true,
    count: summaries.length,
    characters: summaries,
  };
}

export function findCharacterByName(storage: Storage, name: string) {
  const activeId = storage.activeCampaignId;
  const queryLower = name.trim().toLowerCase();
  if (!queryLower) {
    return { success: true, count: 0, matches: [] };
  }

  const matches = storage.characters
    .filter((c) => c.campaignId === activeId && c.name.trim().toLowerCase() === queryLower)
    .map((c) => ({
      id: c.id,
      campaignId: c.campaignId,
      name: c.name,
      house: c.house,
      status: c.status,
      tags: c.tags,
      historyCount: (c.historyLog || []).length,
    }));

  return {
    success: true,
    count: matches.length,
    matches,
  };
}

export function getCharacter(storage: Storage, nameOrId: string) {
  const activeId = storage.activeCampaignId;
  const query = nameOrId.trim();

  // 1. Exact ID match scoped to active campaign
  const byId = storage.characters.find((c) => c.id === query && c.campaignId === activeId);
  if (byId) {
    return { success: true, character: byId };
  }

  // 2. Case-insensitive name match scoped to active campaign
  const queryLower = query.toLowerCase();
  const nameMatches = storage.characters.filter(
    (c) => c.campaignId === activeId && c.name.toLowerCase() === queryLower
  );

  if (nameMatches.length === 1) {
    return { success: true, character: nameMatches[0] };
  } else if (nameMatches.length > 1) {
    return {
      success: false,
      disambiguationRequired: true,
      message: `Multiple characters matched name '${nameOrId}'. Please disambiguate by id.`,
      matches: nameMatches.map((c) => ({ id: c.id, name: c.name, house: c.house, status: c.status })),
    };
  }

  // Fallback: substring match on name scoped to active campaign
  const substringMatches = storage.characters.filter(
    (c) => c.campaignId === activeId && c.name.toLowerCase().includes(queryLower)
  );
  if (substringMatches.length === 1) {
    return { success: true, character: substringMatches[0] };
  } else if (substringMatches.length > 1) {
    return {
      success: false,
      disambiguationRequired: true,
      message: `Multiple characters contained '${nameOrId}' in their name. Please disambiguate by id.`,
      matches: substringMatches.map((c) => ({ id: c.id, name: c.name, house: c.house, status: c.status })),
    };
  }

  return { success: false, message: `Character '${nameOrId}' not found in active campaign.` };
}

export function upsertCharacter(
  storage: Storage,
  input: z.infer<typeof CharacterSchema>
) {
  const activeId = storage.activeCampaignId;
  const now = Date.now();
  let existingIndex = -1;

  if (input.id) {
    existingIndex = storage.characters.findIndex((c) => c.id === input.id && c.campaignId === activeId);
    if (existingIndex === -1) {
      return { success: false, message: `Cannot update: character with id '${input.id}' not found in active campaign.` };
    }
  }

  if (existingIndex >= 0) {
    const existing = storage.characters[existingIndex];
    const historyLog: HistoryLogEntry[] = [...(existing.historyLog || [])];

    if (input.note) {
      historyLog.push({
        timestamp: now,
        date: input.date,
        note: input.note,
      });
    } else if (input.historyLog && input.historyLog.length > 0) {
      for (const entry of input.historyLog) {
        historyLog.push({
          timestamp: entry.timestamp || now,
          date: entry.date || input.date,
          note: entry.note,
        });
      }
    } else if (input.trajectory && input.trajectory !== existing.trajectory) {
      historyLog.push({
        timestamp: now,
        date: input.date,
        note: `Trajectory updated: ${input.trajectory}`,
      });
    }

    const updated: Character = {
      ...existing,
      ...input,
      id: existing.id,
      campaignId: existing.campaignId,
      historyLog,
      createdAt: existing.createdAt,
      updatedAt: now,
    };

    storage.characters[existingIndex] = updated;
    storage.scheduleWrite('characters');
    return { success: true, character: updated };
  } else {
    const newId = generateId();
    const historyLog: HistoryLogEntry[] = [];

    if (input.historyLog && input.historyLog.length > 0) {
      for (const entry of input.historyLog) {
        historyLog.push({
          timestamp: entry.timestamp || now,
          date: entry.date || input.date,
          note: entry.note,
        });
      }
    }

    if (input.note) {
      historyLog.push({
        timestamp: now,
        date: input.date,
        note: input.note,
      });
    } else if (input.trajectory) {
      historyLog.push({
        timestamp: now,
        date: input.date,
        note: `Initial Trajectory: ${input.trajectory}`,
      });
    }

    const created: Character = {
      id: newId,
      campaignId: activeId,
      name: input.name,
      house: input.house,
      status: input.status || 'alive',
      tags: input.tags || [],
      face: input.face,
      voice: input.voice,
      coreDrive: input.coreDrive,
      flaw: input.flaw,
      modernAnalogue: input.modernAnalogue,
      relationships: input.relationships,
      trajectory: input.trajectory,
      historyLog,
      createdAt: now,
      updatedAt: now,
    };

    storage.characters.push(created);
    storage.scheduleWrite('characters');
    return { success: true, character: created };
  }
}

export function deleteCharacter(storage: Storage, id: string) {
  const activeId = storage.activeCampaignId;
  const index = storage.characters.findIndex((c) => c.id === id && c.campaignId === activeId);
  if (index === -1) {
    return { success: false, message: `Character with id '${id}' not found in active campaign.` };
  }
  const deleted = storage.characters.splice(index, 1)[0];
  storage.scheduleWrite('characters');
  return { success: true, message: `Deleted character '${deleted.name}' (${deleted.id}).` };
}
