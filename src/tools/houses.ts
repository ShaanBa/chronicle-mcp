import { Storage, generateId } from '../storage.js';
import { House, HouseSchema, HistoryLogEntry } from '../schema.js';
import { z } from 'zod';

export function listHouses(
  storage: Storage,
  filter?: { status?: string; tag?: string }
) {
  const activeId = storage.activeCampaignId;
  let houses = storage.houses.filter((h) => h.campaignId === activeId);

  if (filter?.status) {
    const statusLower = filter.status.toLowerCase();
    houses = houses.filter((h) => h.status.toLowerCase() === statusLower);
  }

  if (filter?.tag) {
    const tagLower = filter.tag.toLowerCase();
    houses = houses.filter((h) => h.tags.some((t) => t.toLowerCase() === tagLower));
  }

  const summaries = houses.map((h) => ({
    id: h.id,
    campaignId: h.campaignId,
    name: h.name,
    headCharacterId: h.headCharacterId,
    status: h.status,
    words: h.words,
    sigil: h.sigil,
    seat: h.seat,
    culture: h.culture,
    religion: h.religion,
    reputation: h.reputation,
    tags: h.tags,
    historyCount: (h.historyLog || []).length,
  }));

  return {
    success: true,
    count: summaries.length,
    houses: summaries,
  };
}

export function findHouseByName(storage: Storage, name: string) {
  const activeId = storage.activeCampaignId;
  const queryLower = name.trim().toLowerCase();
  if (!queryLower) {
    return { success: true, count: 0, matches: [] };
  }

  const matches = storage.houses
    .filter((h) => h.campaignId === activeId && h.name.trim().toLowerCase() === queryLower)
    .map((h) => ({
      id: h.id,
      campaignId: h.campaignId,
      name: h.name,
      status: h.status,
      tags: h.tags,
    }));

  return {
    success: true,
    count: matches.length,
    matches,
  };
}

export function getHouse(storage: Storage, nameOrId: string) {
  const activeId = storage.activeCampaignId;
  const query = nameOrId.trim();

  // 1. Exact ID match scoped to active campaign
  const byId = storage.houses.find((h) => h.id === query && h.campaignId === activeId);
  if (byId) {
    return { success: true, house: byId };
  }

  // 2. Case-insensitive name match scoped to active campaign
  const queryLower = query.toLowerCase();
  const nameMatches = storage.houses.filter(
    (h) => h.campaignId === activeId && h.name.toLowerCase() === queryLower
  );

  if (nameMatches.length === 1) {
    return { success: true, house: nameMatches[0] };
  } else if (nameMatches.length > 1) {
    return {
      success: false,
      disambiguationRequired: true,
      message: `Multiple houses matched name '${nameOrId}'. Please disambiguate by id.`,
      matches: nameMatches.map((h) => ({ id: h.id, name: h.name, status: h.status })),
    };
  }

  // Fallback: substring match scoped to active campaign
  const substringMatches = storage.houses.filter(
    (h) => h.campaignId === activeId && h.name.toLowerCase().includes(queryLower)
  );
  if (substringMatches.length === 1) {
    return { success: true, house: substringMatches[0] };
  } else if (substringMatches.length > 1) {
    return {
      success: false,
      disambiguationRequired: true,
      message: `Multiple houses contained '${nameOrId}' in their name. Please disambiguate by id.`,
      matches: substringMatches.map((h) => ({ id: h.id, name: h.name, status: h.status })),
    };
  }

  return { success: false, message: `House '${nameOrId}' not found in active campaign.` };
}

export function upsertHouse(
  storage: Storage,
  input: z.infer<typeof HouseSchema>
) {
  const activeId = storage.activeCampaignId;
  const now = Date.now();
  let existingIndex = -1;

  if (input.id) {
    existingIndex = storage.houses.findIndex((h) => h.id === input.id && h.campaignId === activeId);
    if (existingIndex === -1) {
      return { success: false, message: `Cannot update: house with id '${input.id}' not found in active campaign.` };
    }
  }

  if (existingIndex >= 0) {
    const existing = storage.houses[existingIndex];
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
    }

    const updated: House = {
      ...existing,
      ...input,
      id: existing.id,
      campaignId: existing.campaignId,
      words: input.words ?? existing.words,
      sigil: input.sigil ?? existing.sigil,
      seat: input.seat ?? existing.seat,
      culture: input.culture ?? existing.culture,
      religion: input.religion ?? existing.religion,
      reputation: input.reputation ?? existing.reputation,
      cadetOfHouseId: input.cadetOfHouseId ?? existing.cadetOfHouseId,
      historyLog,
      createdAt: existing.createdAt,
      updatedAt: now,
    };

    storage.houses[existingIndex] = updated;
    storage.scheduleWrite('houses');
    return { success: true, house: updated };
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
    }

    const created: House = {
      id: newId,
      campaignId: activeId,
      name: input.name,
      headCharacterId: input.headCharacterId,
      status: input.status || 'ruling',
      holdings: input.holdings || [],
      prestige: input.prestige,
      tags: input.tags || [],
      words: input.words,
      sigil: input.sigil,
      seat: input.seat,
      culture: input.culture,
      religion: input.religion,
      reputation: input.reputation,
      cadetOfHouseId: input.cadetOfHouseId,
      historyLog,
      createdAt: now,
      updatedAt: now,
    };

    storage.houses.push(created);
    storage.scheduleWrite('houses');
    return { success: true, house: created };
  }
}

export function deleteHouse(storage: Storage, id: string) {
  const activeId = storage.activeCampaignId;
  const index = storage.houses.findIndex((h) => h.id === id && h.campaignId === activeId);
  if (index === -1) {
    return { success: false, message: `House with id '${id}' not found in active campaign.` };
  }

  const deleted = storage.houses.splice(index, 1)[0];
  storage.scheduleWrite('houses');
  return { success: true, message: `Deleted house '${deleted.name}' (${deleted.id}).` };
}
