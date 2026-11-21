import { Storage, generateId, resolveCharacterRef } from '../storage.js';
import { TimelineEntry, TimelineEntrySchema, TimelineUpdateSchema } from '../schema.js';
import { z } from 'zod';

export function listTimeline(
  storage: Storage,
  filter?: { tag?: string; dateContains?: string },
  limit: number = 20
) {
  const activeId = storage.activeCampaignId;
  let entries = storage.timeline.filter((e) => e.campaignId === activeId);

  if (filter?.tag) {
    const tagLower = filter.tag.toLowerCase();
    entries = entries.filter((e) =>
      e.tags.some((t) => t.toLowerCase() === tagLower)
    );
  }

  if (filter?.dateContains) {
    const dateLower = filter.dateContains.toLowerCase();
    entries = entries.filter(
      (e) => e.date && e.date.toLowerCase().includes(dateLower)
    );
  }

  entries.sort((a, b) => {
    if (typeof b.sortYear === 'number' && typeof a.sortYear === 'number' && b.sortYear !== a.sortYear) {
      return b.sortYear - a.sortYear;
    }
    return b.createdAt - a.createdAt;
  });

  const sliced = entries.slice(0, limit);

  return {
    success: true,
    count: sliced.length,
    totalCount: entries.length,
    entries: sliced,
  };
}

export function getTimelineEntry(storage: Storage, id: string) {
  const activeId = storage.activeCampaignId;
  const entry = storage.timeline.find((e) => e.id === id && e.campaignId === activeId);
  if (!entry) {
    return { success: false, message: `Timeline entry with id '${id}' not found in active campaign.` };
  }
  return { success: true, entry };
}

export function logTimelineEvent(
  storage: Storage,
  input: z.infer<typeof TimelineEntrySchema>
) {
  const activeId = storage.activeCampaignId;
  const now = Date.now();
  const newEntry: TimelineEntry = {
    id: generateId(),
    campaignId: activeId,
    title: input.title,
    date: input.date,
    sortYear: input.sortYear,
    tags: input.tags || [],
    narrative: input.narrative,
    mechanicalOutcome: input.mechanicalOutcome,
    createdAt: now,
    updatedAt: now,
  };

  storage.timeline.push(newEntry);
  storage.scheduleWrite('timeline');

  // Auto-sync: Append history log entry for any character in active campaign tagged in this timeline event
  if (input.tags && input.tags.length > 0) {
    const gist = input.narrative.length > 120 ? input.narrative.slice(0, 120) + '...' : input.narrative;
    const noteText = `Timeline Event: ${input.title}${gist ? ` — ${gist}` : ''}`;

    for (const rawTag of input.tags) {
      const tagTrimmed = rawTag.trim();
      if (!tagTrimmed) continue;

      const canonicalId = resolveCharacterRef(storage, activeId, tagTrimmed);
      const matchingChar = storage.characters.find(
        (c) => c.campaignId === activeId && c.id === canonicalId
      );

      if (matchingChar) {
        if (!matchingChar.historyLog) {
          matchingChar.historyLog = [];
        }

        const alreadyLogged = matchingChar.historyLog.some(
          (h) => h.note === noteText && h.date === input.date
        );

        if (!alreadyLogged) {
          matchingChar.historyLog.push({
            timestamp: now,
            date: input.date || 'Unspecified date',
            note: noteText,
          });
          matchingChar.updatedAt = now;
          storage.scheduleWrite('characters');
        }
      }
    }
  }

  // Smart Nudge Hints: check for cultural echo or intrigue opportunities
  const suggestions: string[] = [];
  const narrativeLower = (input.narrative || '').toLowerCase();
  const titleLower = (input.title || '').toLowerCase();
  const outcome = input.mechanicalOutcome;

  if (outcome) {
    const hasCasualties = Boolean(outcome.casualties);
    const hasTerritory = Boolean(outcome.territoryChange);
    const largePrestige = Math.abs(outcome.prestigeDelta || 0) >= 100;
    if (hasCasualties || hasTerritory || largePrestige) {
      suggestions.push(
        'Major outcome detected: Consider authoring a short biased Tome (ballad, letter, or decree) with upsert_tome to capture the cultural echo.'
      );
    }
  }

  const intrigueRegex = /\b(secret|poison|murder|assassin|bastard|conspiracy|bribe|forged|forgery|plot|treason|covert|leverage)\b/i;
  if (intrigueRegex.test(narrativeLower) || intrigueRegex.test(titleLower)) {
    suggestions.push(
      'Intrigue keywords detected: Consider recording a corresponding Secret with upsert_secret to track hidden truth, cover stories, and leverage separately from public history.'
    );
  }

  return {
    success: true,
    entry: newEntry,
    ...(suggestions.length > 0 ? { suggestions } : {}),
  };
}

export function updateTimelineEntry(
  storage: Storage,
  id: string,
  patch: z.infer<typeof TimelineUpdateSchema>
) {
  const activeId = storage.activeCampaignId;
  const index = storage.timeline.findIndex((e) => e.id === id && e.campaignId === activeId);
  if (index === -1) {
    return { success: false, message: `Timeline entry with id '${id}' not found in active campaign.` };
  }

  const existing = storage.timeline[index];
  const updated: TimelineEntry = {
    ...existing,
    title: patch.title ?? existing.title,
    date: patch.date ?? existing.date,
    sortYear: patch.sortYear ?? existing.sortYear,
    tags: patch.tags ?? existing.tags,
    narrative: patch.narrative ?? existing.narrative,
    mechanicalOutcome: patch.mechanicalOutcome ?? existing.mechanicalOutcome,
    updatedAt: Date.now(),
  };

  storage.timeline[index] = updated;
  storage.scheduleWrite('timeline');
  return { success: true, entry: updated };
}

export function deleteTimelineEntry(storage: Storage, id: string) {
  const activeId = storage.activeCampaignId;
  const index = storage.timeline.findIndex((e) => e.id === id && e.campaignId === activeId);
  if (index === -1) {
    return { success: false, message: `Timeline entry with id '${id}' not found in active campaign.` };
  }

  const deleted = storage.timeline.splice(index, 1)[0];
  storage.scheduleWrite('timeline');
  return { success: true, message: `Deleted timeline entry '${deleted.title}' (${deleted.id}).` };
}
