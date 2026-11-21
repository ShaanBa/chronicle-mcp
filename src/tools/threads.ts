import { Storage, generateId, resolveCharacterRef } from '../storage.js';
import { Thread, ThreadSchema } from '../schema.js';
import { z } from 'zod';

export function listThreads(
  storage: Storage,
  filter?: { status?: 'open' | 'resolved' | 'dormant'; tag?: string }
) {
  const activeId = storage.activeCampaignId;
  let threads = storage.threads.filter((t) => t.campaignId === activeId);

  if (filter?.status) {
    const statusLower = filter.status.toLowerCase();
    threads = threads.filter((t) => t.status.toLowerCase() === statusLower);
  }

  if (filter?.tag) {
    const tagLower = filter.tag.toLowerCase();
    threads = threads.filter((t) => t.tags.some((tg) => tg.toLowerCase() === tagLower));
  }

  threads.sort((a, b) => b.createdAt - a.createdAt);

  return {
    success: true,
    count: threads.length,
    threads,
  };
}

export function getThread(storage: Storage, id: string) {
  const activeId = storage.activeCampaignId;
  const thread = storage.threads.find((t) => t.id === id && t.campaignId === activeId);
  if (!thread) {
    return { success: false, message: `Thread with id '${id}' not found in active campaign.` };
  }
  return { success: true, thread };
}

export function upsertThread(
  storage: Storage,
  input: z.infer<typeof ThreadSchema>
) {
  const activeId = storage.activeCampaignId;
  const now = Date.now();
  let existingIndex = -1;

  if (input.id) {
    existingIndex = storage.threads.findIndex((t) => t.id === input.id && t.campaignId === activeId);
    if (existingIndex === -1) {
      return { success: false, message: `Cannot update: thread with id '${input.id}' not found in active campaign.` };
    }
  }

  if (existingIndex >= 0) {
    const existing = storage.threads[existingIndex];
    const resolvedRelatedChars = input.relatedCharacterIds
      ? input.relatedCharacterIds.map((ref) => resolveCharacterRef(storage, activeId, ref))
      : undefined;

    const updated: Thread = {
      ...existing,
      ...input,
      id: existing.id,
      campaignId: existing.campaignId,
      status: input.status ?? existing.status ?? 'open',
      relatedCharacterIds: resolvedRelatedChars ?? (existing.relatedCharacterIds || []),
      relatedEventIds: input.relatedEventIds ?? (existing.relatedEventIds || []),
      tags: input.tags ?? (existing.tags || []),
      createdAt: existing.createdAt,
      updatedAt: now,
    };
    storage.threads[existingIndex] = updated;
    storage.scheduleWrite('threads');
    return { success: true, thread: updated };
  } else {
    const newId = generateId();
    const resolvedRelatedChars = (input.relatedCharacterIds || []).map((ref) =>
      resolveCharacterRef(storage, activeId, ref)
    );
    const created: Thread = {
      id: newId,
      campaignId: activeId,
      title: input.title,
      status: input.status || 'open',
      summary: input.summary,
      relatedCharacterIds: resolvedRelatedChars,
      relatedEventIds: input.relatedEventIds || [],
      tags: input.tags || [],
      createdAt: now,
      updatedAt: now,
    };
    storage.threads.push(created);
    storage.scheduleWrite('threads');
    return { success: true, thread: created };
  }
}

export function resolveThread(
  storage: Storage,
  id: string,
  resolutionNote: string
) {
  const activeId = storage.activeCampaignId;
  const index = storage.threads.findIndex((t) => t.id === id && t.campaignId === activeId);
  if (index === -1) {
    return { success: false, message: `Thread with id '${id}' not found in active campaign.` };
  }

  const existing = storage.threads[index];
  const updatedSummary = `${existing.summary}\n\nResolution: ${resolutionNote}`;
  const updated: Thread = {
    ...existing,
    status: 'resolved',
    summary: updatedSummary,
    updatedAt: Date.now(),
  };

  storage.threads[index] = updated;
  storage.scheduleWrite('threads');
  return { success: true, thread: updated };
}

export function deleteThread(storage: Storage, id: string) {
  const activeId = storage.activeCampaignId;
  const index = storage.threads.findIndex((t) => t.id === id && t.campaignId === activeId);
  if (index === -1) {
    return { success: false, message: `Thread with id '${id}' not found in active campaign.` };
  }

  const deleted = storage.threads.splice(index, 1)[0];
  storage.scheduleWrite('threads');
  return { success: true, message: `Deleted plot thread '${deleted.title}' (${deleted.id}).` };
}
