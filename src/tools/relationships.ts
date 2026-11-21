import { Storage, generateId, resolveEntityRef, resolveCharacterRef } from '../storage.js';
import { RelationshipEdge, RelationshipEdgeSchema } from '../schema.js';
import { z } from 'zod';

export function getInverseType(type: RelationshipEdge['type']): RelationshipEdge['type'] {
  switch (type) {
    case 'parent':
      return 'child';
    case 'child':
      return 'parent';
    case 'liege':
      return 'vassal';
    case 'vassal':
      return 'liege';
    case 'debtor':
      return 'creditor';
    case 'creditor':
      return 'debtor';
    case 'spouse':
    case 'ally':
    case 'rival':
    case 'enemy':
    case 'sibling':
    case 'other':
    default:
      return type;
  }
}

export function addRelationship(
  storage: Storage,
  input: z.infer<typeof RelationshipEdgeSchema>
) {
  const activeId = storage.activeCampaignId;
  const now = Date.now();

  const resolvedFromId = input.fromType === 'character'
    ? resolveCharacterRef(storage, activeId, input.fromId)
    : resolveEntityRef(storage, activeId, 'house', input.fromId);

  const resolvedToId = input.toType === 'character'
    ? resolveCharacterRef(storage, activeId, input.toId)
    : resolveEntityRef(storage, activeId, 'house', input.toId);

  // Validate that both 'from' and 'to' entities belong to the active campaign
  let fromExists = false;
  if (input.fromType === 'character') {
    fromExists = storage.characters.some(
      (c) => c.campaignId === activeId && (c.id === resolvedFromId || c.name.toLowerCase() === input.fromId.toLowerCase())
    );
  } else {
    fromExists = storage.houses.some(
      (h) => h.campaignId === activeId && (h.id === resolvedFromId || h.name.toLowerCase() === input.fromId.toLowerCase())
    );
  }

  let toExists = false;
  if (input.toType === 'character') {
    toExists = storage.characters.some(
      (c) => c.campaignId === activeId && (c.id === resolvedToId || c.name.toLowerCase() === input.toId.toLowerCase())
    );
  } else {
    toExists = storage.houses.some(
      (h) => h.campaignId === activeId && (h.id === resolvedToId || h.name.toLowerCase() === input.toId.toLowerCase())
    );
  }

  if (!fromExists) {
    return {
      success: false,
      message: `Cannot create relationship: ${input.fromType} '${input.fromId}' not found in active campaign.`,
    };
  }

  if (!toExists) {
    return {
      success: false,
      message: `Cannot create relationship: ${input.toType} '${input.toId}' not found in active campaign.`,
    };
  }

  // Deduplication check scoped to active campaign
  const existingIndex = storage.relationships.findIndex(
    (e) =>
      e.campaignId === activeId &&
      e.fromType === input.fromType &&
      (e.fromId === resolvedFromId || e.fromId === input.fromId) &&
      e.toType === input.toType &&
      (e.toId === resolvedToId || e.toId === input.toId) &&
      e.type === input.type
  );

  if (existingIndex >= 0) {
    const existingEdge = storage.relationships[existingIndex];
    existingEdge.note = input.note ?? existingEdge.note;
    if (input.isSecret !== undefined) existingEdge.isSecret = input.isSecret;
    if (input.sentiment !== undefined) existingEdge.sentiment = input.sentiment;
    if (input.publicFacade !== undefined) existingEdge.publicFacade = input.publicFacade;
    existingEdge.createdAt = now;

    const inverseEdge = storage.relationships.find(
      (e) => e.campaignId === activeId && e.pairId === existingEdge.pairId && e.id !== existingEdge.id
    );
    if (inverseEdge) {
      if (input.note && !input.oneWay) {
        inverseEdge.note = `Inverse of ${input.type}: ${input.note}`;
      }
      inverseEdge.createdAt = now;
    }

    storage.scheduleWrite('relationships');
    return {
      success: true,
      updated: true,
      edge: existingEdge,
      inverseEdge,
    };
  }

  // Create new paired relationship edges stamped with activeCampaignId
  const pairId = generateId();
  const forwardEdge: RelationshipEdge = {
    id: generateId(),
    campaignId: activeId,
    pairId,
    fromType: input.fromType,
    fromId: resolvedFromId,
    toType: input.toType,
    toId: resolvedToId,
    type: input.type,
    note: input.note,
    isSecret: input.isSecret,
    sentiment: input.sentiment,
    publicFacade: input.publicFacade,
    createdAt: now,
  };

  const inverseType = input.oneWay ? 'other' : getInverseType(input.type);
  const inverseNote = input.oneWay
    ? "Unaware of counterpart's true stance"
    : (input.note ? `Inverse of ${input.type}: ${input.note}` : undefined);

  const inverseEdge: RelationshipEdge = {
    id: generateId(),
    campaignId: activeId,
    pairId,
    fromType: input.toType,
    fromId: resolvedToId,
    toType: input.fromType,
    toId: resolvedFromId,
    type: inverseType,
    note: inverseNote,
    createdAt: now,
  };

  storage.relationships.push(forwardEdge, inverseEdge);
  storage.scheduleWrite('relationships');

  return {
    success: true,
    created: true,
    edge: forwardEdge,
    inverseEdge,
  };
}

export function listRelationships(
  storage: Storage,
  entityType: 'character' | 'house',
  entityId: string,
  includeSecrets: boolean = true
) {
  const activeId = storage.activeCampaignId;
  const canonicalId = entityType === 'character'
    ? resolveCharacterRef(storage, activeId, entityId)
    : resolveEntityRef(storage, activeId, 'house', entityId);

  // Find all edges where entity is fromId scoped to active campaign
  let edges = storage.relationships.filter(
    (e) =>
      e.campaignId === activeId &&
      e.fromType === entityType &&
      (e.fromId === canonicalId || e.fromId.toLowerCase() === entityId.trim().toLowerCase())
  );

  if (!includeSecrets) {
    edges = edges.filter((e) => !e.isSecret);
  }

  const resolved = edges.map((e) => {
    let targetName = e.toId;
    let targetStatus: string | undefined = undefined;
    let targetHouse: string | undefined = undefined;

    if (e.toType === 'character') {
      const char = storage.characters.find(
        (c) => c.campaignId === activeId && (c.id === e.toId || c.name.toLowerCase() === e.toId.toLowerCase())
      );
      if (char) {
        targetName = char.name;
        targetStatus = char.status;
        targetHouse = char.house;
      }
    } else if (e.toType === 'house') {
      const house = storage.houses.find(
        (h) => h.campaignId === activeId && (h.id === e.toId || h.name.toLowerCase() === e.toId.toLowerCase())
      );
      if (house) {
        targetName = house.name;
        targetStatus = house.status;
      }
    }

    return {
      id: e.id,
      campaignId: e.campaignId,
      pairId: e.pairId,
      fromType: e.fromType,
      fromId: e.fromId,
      toType: e.toType,
      toId: e.toId,
      type: e.type,
      note: e.note,
      isSecret: e.isSecret,
      sentiment: e.sentiment,
      publicFacade: e.publicFacade,
      createdAt: e.createdAt,
      targetName,
      targetStatus,
      targetHouse,
    };
  });

  return {
    success: true,
    count: resolved.length,
    relationships: resolved,
  };
}

export function removeRelationship(storage: Storage, id: string) {
  const activeId = storage.activeCampaignId;
  const targetEdge = storage.relationships.find((e) => e.id === id && e.campaignId === activeId);
  if (!targetEdge) {
    return { success: false, message: `Relationship edge with id '${id}' not found in active campaign.` };
  }

  const pairId = targetEdge.pairId;
  const initialLength = storage.relationships.length;
  storage.relationships = storage.relationships.filter(
    (e) => !(e.campaignId === activeId && (e.id === id || e.pairId === pairId))
  );

  const removedCount = initialLength - storage.relationships.length;
  storage.scheduleWrite('relationships');

  return {
    success: true,
    message: `Removed relationship ${targetEdge.type} (${targetEdge.id}) and its paired inverse edge (${removedCount} edges removed).`,
  };
}
