import { Storage, generateId, resolveEntityRef, resolveCharacterRef } from '../storage.js';
import { Secret, SecretSchema, TimelineEntry } from '../schema.js';
import { z } from 'zod';

export function upsertSecret(
  storage: Storage,
  input: z.infer<typeof SecretSchema>
) {
  const activeCampaignId = input.campaignId || storage.activeCampaignId;
  const isUpdate = Boolean(input.id);

  // Normalize references
  const resolvedSubjects = [
    ...new Set((input.subjectIds || []).map((ref) => resolveEntityRef(storage, activeCampaignId, 'any', ref))),
  ];
  const resolvedKnown = [
    ...new Set((input.knownByCharacterIds || []).map((ref) => resolveCharacterRef(storage, activeCampaignId, ref))),
  ];
  // Knowing supersedes suspecting: if character is in knownBy, they cannot be in suspectedBy
  const resolvedSuspected = [
    ...new Set((input.suspectedByCharacterIds || []).map((ref) => resolveCharacterRef(storage, activeCampaignId, ref))),
  ].filter((id) => !resolvedKnown.includes(id));

  let secret: Secret;

  if (isUpdate) {
    const existingIndex = storage.secrets.findIndex((s) => s.id === input.id);
    if (existingIndex === -1) {
      return {
        success: false,
        message: `Secret with id '${input.id}' not found.`,
      };
    }

    const existing = storage.secrets[existingIndex];
    if (existing.campaignId !== activeCampaignId) {
      return {
        success: false,
        message: `Secret with id '${input.id}' not found in active campaign '${activeCampaignId}'.`,
      };
    }

    const historyLog = [...(existing.historyLog || [])];
    if (input.note || (input.status && input.status !== existing.status)) {
      historyLog.push({
        timestamp: Date.now(),
        date: input.date || existing.historyLog[existing.historyLog.length - 1]?.date,
        note: input.note || `Status shifted from '${existing.status}' to '${input.status}'.`,
      });
    }

    secret = {
      ...existing,
      title: input.title,
      truth: input.truth,
      publicCoverStory: input.publicCoverStory ?? existing.publicCoverStory,
      severity: input.severity ?? existing.severity,
      status: input.status ?? existing.status,
      subjectIds: resolvedSubjects.length > 0 ? resolvedSubjects : existing.subjectIds,
      knownByCharacterIds: resolvedKnown,
      suspectedByCharacterIds: resolvedSuspected,
      leverageNote: input.leverageNote ?? existing.leverageNote,
      relatedEventIds: input.relatedEventIds ?? existing.relatedEventIds,
      tags: input.tags ?? existing.tags,
      historyLog,
      updatedAt: Date.now(),
    };

    storage.secrets[existingIndex] = secret;
  } else {
    const newId = generateId();
    const historyLog = [];
    historyLog.push({
      timestamp: Date.now(),
      date: input.date,
      note: input.note || `Secret established with status '${input.status}'.`,
    });

    secret = {
      id: newId,
      campaignId: activeCampaignId,
      title: input.title,
      truth: input.truth,
      publicCoverStory: input.publicCoverStory,
      severity: input.severity,
      status: input.status,
      subjectIds: resolvedSubjects,
      knownByCharacterIds: resolvedKnown,
      suspectedByCharacterIds: resolvedSuspected,
      leverageNote: input.leverageNote,
      relatedEventIds: input.relatedEventIds || [],
      tags: input.tags || [],
      historyLog,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    storage.secrets.push(secret);
  }

  storage.scheduleWrite('secrets');

  return {
    success: true,
    message: isUpdate ? `Updated secret '${secret.title}' (${secret.id}).` : `Created secret '${secret.title}' (${secret.id}).`,
    secret,
  };
}

export function updateSecretKnowledge(
  storage: Storage,
  params: {
    secretId: string;
    characterId: string;
    action: 'learns' | 'suspects' | 'forgets' | 'exposes';
    date?: string;
    note?: string;
    autoLogTimelineEvent?: boolean;
    campaignId?: string;
  }
) {
  const activeCampaignId = params.campaignId || storage.activeCampaignId;
  const canonicalCharId = resolveCharacterRef(storage, activeCampaignId, params.characterId);
  const character = storage.characters.find((c) => c.campaignId === activeCampaignId && c.id === canonicalCharId);
  const charDisplayName = character ? character.name : canonicalCharId;

  // Resolve secret by ID or exact title
  const secret = storage.secrets.find(
    (s) =>
      s.campaignId === activeCampaignId &&
      (s.id === params.secretId || s.title.toLowerCase() === params.secretId.trim().toLowerCase())
  );

  if (!secret) {
    return {
      success: false,
      message: `Secret '${params.secretId}' not found in active campaign.`,
    };
  }

  let note = params.note;

  switch (params.action) {
    case 'learns': {
      if (!secret.knownByCharacterIds.includes(canonicalCharId)) {
        secret.knownByCharacterIds.push(canonicalCharId);
      }
      // Knowing supersedes suspecting
      secret.suspectedByCharacterIds = secret.suspectedByCharacterIds.filter((id) => id !== canonicalCharId);
      if (!note) note = `${charDisplayName} learned the ground truth of this secret.`;
      break;
    }
    case 'suspects': {
      // If already known, do not demote to suspected
      if (secret.knownByCharacterIds.includes(canonicalCharId)) {
        return {
          success: true,
          message: `${charDisplayName} already knows this secret directly; suspicion not added.`,
          secret,
        };
      }
      if (!secret.suspectedByCharacterIds.includes(canonicalCharId)) {
        secret.suspectedByCharacterIds.push(canonicalCharId);
      }
      if (!note) note = `${charDisplayName} began harboring suspicions regarding this secret.`;
      break;
    }
    case 'forgets': {
      secret.knownByCharacterIds = secret.knownByCharacterIds.filter((id) => id !== canonicalCharId);
      secret.suspectedByCharacterIds = secret.suspectedByCharacterIds.filter((id) => id !== canonicalCharId);
      if (!note) note = `${charDisplayName} no longer holds knowledge or suspicion of this secret.`;
      break;
    }
    case 'exposes': {
      secret.status = 'exposed';
      if (!secret.knownByCharacterIds.includes(canonicalCharId)) {
        secret.knownByCharacterIds.push(canonicalCharId);
      }
      secret.suspectedByCharacterIds = secret.suspectedByCharacterIds.filter((id) => id !== canonicalCharId);
      if (!note) note = `${charDisplayName} exposed this secret publicly to the realm!`;

      if (params.autoLogTimelineEvent) {
        const eventId = generateId();
        const eventTags = [...new Set([charDisplayName, ...secret.tags, 'Secret Exposure', 'secret-exposed'])];
        const narrative = `${charDisplayName} exposed the secret truth of '${secret.title}' to the realm: ${secret.truth}`;

        const timelineEntry: TimelineEntry = {
          id: eventId,
          campaignId: activeCampaignId,
          title: `Exposed: ${secret.title}`,
          date: params.date,
          tags: eventTags,
          narrative,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        storage.timeline.push(timelineEntry);
        secret.relatedEventIds.push(eventId);
        storage.scheduleWrite('timeline');
      }
      break;
    }
  }

  secret.historyLog.push({
    timestamp: Date.now(),
    date: params.date,
    note,
  });
  secret.updatedAt = Date.now();

  storage.scheduleWrite('secrets');

  return {
    success: true,
    message: `Updated secret '${secret.title}': ${charDisplayName} ${params.action}.`,
    secret,
  };
}

export function listSecrets(
  storage: Storage,
  filters?: {
    status?: 'buried' | 'whispered' | 'exposed' | 'discredited';
    severity?: 'gossip' | 'scandal' | 'treason' | 'dynasty_ending';
    subjectId?: string;
    knownByCharacterId?: string;
    unexposedOnly?: boolean;
    campaignId?: string;
  }
) {
  const activeCampaignId = filters?.campaignId || storage.activeCampaignId;
  let matches = storage.secrets.filter((s) => s.campaignId === activeCampaignId);

  if (filters?.status) {
    matches = matches.filter((s) => s.status === filters.status);
  }
  if (filters?.severity) {
    matches = matches.filter((s) => s.severity === filters.severity);
  }
  if (filters?.unexposedOnly) {
    matches = matches.filter((s) => s.status !== 'exposed');
  }
  if (filters?.subjectId) {
    const resolvedSubject = resolveEntityRef(storage, activeCampaignId, 'any', filters.subjectId);
    matches = matches.filter((s) => s.subjectIds.includes(resolvedSubject));
  }
  if (filters?.knownByCharacterId) {
    const resolvedChar = resolveCharacterRef(storage, activeCampaignId, filters.knownByCharacterId);
    matches = matches.filter((s) => s.knownByCharacterIds.includes(resolvedChar));
  }

  // Enrich with readable names
  const enriched = matches.map((s) => {
    const subjectNames = s.subjectIds.map((id) => {
      const c = storage.characters.find((ch) => ch.campaignId === activeCampaignId && ch.id === id);
      if (c) return c.name;
      const h = storage.houses.find((ho) => ho.campaignId === activeCampaignId && ho.id === id);
      if (h) return `House ${h.name}`;
      return id;
    });

    const knownByNames = s.knownByCharacterIds.map((id) => {
      const c = storage.characters.find((ch) => ch.campaignId === activeCampaignId && ch.id === id);
      return c ? c.name : id;
    });

    const suspectedByNames = s.suspectedByCharacterIds.map((id) => {
      const c = storage.characters.find((ch) => ch.campaignId === activeCampaignId && ch.id === id);
      return c ? c.name : id;
    });

    return {
      ...s,
      subjectNames,
      knownByNames,
      suspectedByNames,
    };
  });

  return {
    success: true,
    count: enriched.length,
    activeCampaignId,
    secrets: enriched,
  };
}

export function getCharacterKnowledge(
  storage: Storage,
  params: {
    characterId: string;
    campaignId?: string;
  }
) {
  const activeCampaignId = params.campaignId || storage.activeCampaignId;
  const canonicalCharId = resolveCharacterRef(storage, activeCampaignId, params.characterId);
  const character = storage.characters.find(
    (c) => c.campaignId === activeCampaignId && c.id === canonicalCharId
  );

  const characterName = character ? character.name : params.characterId;

  // 1. Secrets known with certainty
  const knows = storage.secrets
    .filter((s) => s.campaignId === activeCampaignId && s.knownByCharacterIds.includes(canonicalCharId))
    .map((s) => ({
      id: s.id,
      title: s.title,
      truth: s.truth,
      publicCoverStory: s.publicCoverStory,
      severity: s.severity,
      status: s.status,
      leverageNote: s.leverageNote,
      subjectIds: s.subjectIds,
    }));

  // 2. Secrets suspected (STRICT Epistemic Separation: NO Ground Truth if unexposed)
  const suspects = storage.secrets
    .filter((s) => s.campaignId === activeCampaignId && s.suspectedByCharacterIds.includes(canonicalCharId))
    .map((s) => ({
      id: s.id,
      title: s.title,
      // Only reveal truth if the secret has already been publicly exposed
      truth: s.status === 'exposed' ? s.truth : undefined,
      publicCoverStory: s.publicCoverStory || 'Unverified whisper circulating the shadows',
      severity: s.severity,
      status: s.status,
      suspicionNote: 'Character has partial clues or suspicions, but lacks definitive proof.',
      subjectIds: s.subjectIds,
    }));

  // 3. Blind spots: unexposed secrets about this character that they DO NOT know or suspect
  const blindSpotsCount = storage.secrets.filter(
    (s) =>
      s.campaignId === activeCampaignId &&
      s.status !== 'exposed' &&
      s.status !== 'discredited' &&
      s.subjectIds.includes(canonicalCharId) &&
      !s.knownByCharacterIds.includes(canonicalCharId) &&
      !s.suspectedByCharacterIds.includes(canonicalCharId)
  ).length;

  return {
    success: true,
    characterId: canonicalCharId,
    characterName,
    knowsCount: knows.length,
    knows,
    suspectsCount: suspects.length,
    suspects,
    blindSpotsCount,
  };
}
