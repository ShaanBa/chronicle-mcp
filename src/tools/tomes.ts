import { Storage, generateId } from '../storage.js';
import { Tome, TomeSchema } from '../schema.js';
import { z } from 'zod';

export function listTomes(
  storage: Storage,
  filter?: { category?: string; tag?: string }
) {
  const activeId = storage.activeCampaignId;
  let tomes = storage.tomes.filter((t) => t.campaignId === activeId);

  if (filter?.category) {
    const catLower = filter.category.toLowerCase();
    tomes = tomes.filter(
      (t) => t.category && t.category.toLowerCase() === catLower
    );
  }

  if (filter?.tag) {
    const tagLower = filter.tag.toLowerCase();
    tomes = tomes.filter((t) =>
      t.tags.some((tg) => tg.toLowerCase() === tagLower)
    );
  }

  const summaries = tomes.map((t) => ({
    id: t.id,
    title: t.title,
    category: t.category,
    tags: t.tags,
  }));

  return {
    success: true,
    count: summaries.length,
    tomes: summaries,
  };
}

export function findTomeByTitle(storage: Storage, title: string) {
  const activeId = storage.activeCampaignId;
  const queryLower = title.trim().toLowerCase();
  if (!queryLower) {
    return { success: true, count: 0, matches: [] };
  }

  const matches = storage.tomes
    .filter((t) => t.campaignId === activeId && t.title.trim().toLowerCase() === queryLower)
    .map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      tags: t.tags,
    }));

  return {
    success: true,
    count: matches.length,
    matches,
  };
}

export function getTome(storage: Storage, titleOrId: string) {
  const activeId = storage.activeCampaignId;
  const query = titleOrId.trim();

  // 1. Exact ID match scoped to active campaign
  const byId = storage.tomes.find((t) => t.id === query && t.campaignId === activeId);
  if (byId) {
    return { success: true, tome: byId };
  }

  // 2. Case-insensitive title match scoped to active campaign
  const queryLower = query.toLowerCase();
  const titleMatches = storage.tomes.filter(
    (t) => t.campaignId === activeId && t.title.toLowerCase() === queryLower
  );

  if (titleMatches.length === 1) {
    return { success: true, tome: titleMatches[0] };
  } else if (titleMatches.length > 1) {
    return {
      success: false,
      disambiguationRequired: true,
      message: `Multiple tomes matched title '${titleOrId}'. Please disambiguate by id.`,
      matches: titleMatches.map((t) => ({ id: t.id, title: t.title, category: t.category })),
    };
  }

  // Fallback: substring match on title scoped to active campaign
  const substringMatches = storage.tomes.filter(
    (t) => t.campaignId === activeId && t.title.toLowerCase().includes(queryLower)
  );
  if (substringMatches.length === 1) {
    return { success: true, tome: substringMatches[0] };
  } else if (substringMatches.length > 1) {
    return {
      success: false,
      disambiguationRequired: true,
      message: `Multiple tomes contained '${titleOrId}' in their title. Please disambiguate by id.`,
      matches: substringMatches.map((t) => ({ id: t.id, title: t.title, category: t.category })),
    };
  }

  return { success: false, message: `Tome '${titleOrId}' not found in active campaign.` };
}

export function upsertTome(
  storage: Storage,
  input: z.infer<typeof TomeSchema>
) {
  const activeId = storage.activeCampaignId;
  const now = Date.now();
  let existingIndex = -1;

  if (input.id) {
    existingIndex = storage.tomes.findIndex((t) => t.id === input.id && t.campaignId === activeId);
    if (existingIndex === -1) {
      return { success: false, message: `Cannot update: tome with id '${input.id}' not found in active campaign.` };
    }
  }

  if (existingIndex >= 0) {
    const existing = storage.tomes[existingIndex];
    const updated: Tome = {
      ...existing,
      ...input,
      id: existing.id,
      campaignId: existing.campaignId,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
    storage.tomes[existingIndex] = updated;
    storage.scheduleWrite('tomes');
    return { success: true, tome: updated };
  } else {
    const newId = generateId();
    const created: Tome = {
      id: newId,
      campaignId: activeId,
      title: input.title,
      category: input.category,
      tags: input.tags || [],
      content: input.content,
      createdAt: now,
      updatedAt: now,
    };
    storage.tomes.push(created);
    storage.scheduleWrite('tomes');
    return { success: true, tome: created };
  }
}

export function deleteTome(storage: Storage, id: string) {
  const activeId = storage.activeCampaignId;
  const index = storage.tomes.findIndex((t) => t.id === id && t.campaignId === activeId);
  if (index === -1) {
    return { success: false, message: `Tome with id '${id}' not found in active campaign.` };
  }
  const deleted = storage.tomes.splice(index, 1)[0];
  storage.scheduleWrite('tomes');
  return { success: true, message: `Deleted tome '${deleted.title}' (${deleted.id}).` };
}
