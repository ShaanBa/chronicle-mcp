import { Storage, resolveCharacterRef, resolveEntityRef, attachComputedAge } from '../storage.js';
import { SceneBriefingInputSchema } from '../schema.js';
import { z } from 'zod';

export { SceneBriefingInputSchema };

export function buildSceneBriefing(
  storage: Storage,
  input: z.infer<typeof SceneBriefingInputSchema>
) {
  return getSceneBriefing(storage, input);
}

export function getSceneBriefing(
  storage: Storage,
  input: z.infer<typeof SceneBriefingInputSchema>
) {
  const activeCampaignId = input.campaignId || storage.activeCampaignId;
  const campaign = storage.campaigns.find((c) => c.id === activeCampaignId) || storage.getActiveCampaign();

  // 1. Resolve Cast & POV
  const resolvedCastMap = new Map<string, any>();
  const unregisteredCharacters: string[] = [];

  for (const rawNameOrId of input.characterIds) {
    const canonicalId = resolveCharacterRef(storage, activeCampaignId, rawNameOrId);
    const char = storage.characters.find((c) => c.campaignId === activeCampaignId && c.id === canonicalId);

    if (char) {
      if (!resolvedCastMap.has(char.id)) {
        resolvedCastMap.set(char.id, char);
      }
    } else {
      unregisteredCharacters.push(rawNameOrId.trim());
    }
  }

  const resolvedCast = Array.from(resolvedCastMap.values());
  const castIds = resolvedCast.map((c) => c.id);

  // POV resolution
  const rawPov = input.povCharacterId || campaign.playerCharacterId;
  const resolvedPovId = rawPov ? resolveCharacterRef(storage, activeCampaignId, rawPov) : undefined;
  const povCharacter = resolvedPovId
    ? storage.characters.find((c) => c.campaignId === activeCampaignId && c.id === resolvedPovId)
    : undefined;

  // 2. Build Compact Cast Cards
  const cast = resolvedCast.map((c) => {
    const enriched = attachComputedAge(c, campaign);

    // House Banner lookup
    let houseBanner: { name: string; words?: string; sigil?: string; reputation?: string } | undefined = undefined;
    if (c.house) {
      const h = storage.houses.find(
        (ho) =>
          ho.campaignId === activeCampaignId &&
          (ho.id === c.house || ho.name.toLowerCase() === c.house.toLowerCase())
      );
      if (h) {
        houseBanner = {
          name: h.name,
          words: h.words,
          sigil: h.sigil,
          reputation: h.reputation,
        };
      } else {
        houseBanner = { name: c.house };
      }
    }

    // Curate recent history: maximum 2 entries to enforce token-budget discipline
    const recentHistory = (c.historyLog || []).slice(-2).map((h: any) =>
      h.date ? `${h.date}: ${h.note}` : h.note
    );

    // Deep hooks: formative scars up to 3
    const formativeScars = (c.formativeScars || []).slice(0, 3).map((s: any) => s.summary);

    return {
      id: c.id,
      name: c.name,
      epithet: c.epithet,
      titles: c.titles || [],
      status: c.status,
      age: enriched.computedAge ?? enriched.ageAtDeath,
      house: houseBanner,
      traits: c.traits || [],
      culture: c.culture,
      religion: c.religion,
      voice: c.voice,
      speechTells: c.speechTells,
      modernAnalogue: c.modernAnalogue,
      coreDrive: c.coreDrive,
      currentObsession: c.currentObsession,
      flaw: c.flaw,
      formativeScars,
      recentHistory,
    };
  });

  // Collect houses represented by characters in the room
  const representedHouseIds = new Set<string>();
  const representedHouseNames = new Set<string>();
  for (const c of resolvedCast) {
    if (c.house) {
      representedHouseNames.add(c.house.toLowerCase());
      const h = storage.houses.find(
        (house) =>
          house.campaignId === activeCampaignId &&
          (house.id === c.house || house.name.toLowerCase() === c.house.toLowerCase())
      );
      if (h) representedHouseIds.add(h.id);
    }
  }

  // 3. Extract In-Room Relational Friction
  const inRoomRelationships: any[] = [];
  const processedPairs = new Set<string>();

  for (const edge of storage.relationships) {
    if (edge.campaignId !== activeCampaignId) continue;

    // Character-to-character edges between in-room cast
    if (edge.fromType === 'character' && edge.toType === 'character') {
      if (castIds.includes(edge.fromId) && castIds.includes(edge.toId)) {
        const fromChar = resolvedCast.find((c) => c.id === edge.fromId);
        const toChar = resolvedCast.find((c) => c.id === edge.toId);

        // Keep both directions if secret, asymmetric sentiment, or public facade
        const isAsymmetric = edge.isSecret || edge.publicFacade || edge.sentiment !== undefined;
        if (!isAsymmetric && processedPairs.has(edge.pairId)) {
          continue;
        }

        processedPairs.add(edge.pairId);
        inRoomRelationships.push({
          from: fromChar?.name || edge.fromId,
          to: toChar?.name || edge.toId,
          type: edge.type,
          isSecret: edge.isSecret || false,
          sentiment: edge.sentiment,
          publicFacade: edge.publicFacade,
          note: edge.note,
        });
      }
    }

    // House-to-house edges between represented dynasties (strictly requiring BOTH houses present in room)
    if (edge.fromType === 'house' && edge.toType === 'house') {
      const fromMatches = representedHouseIds.has(edge.fromId) || representedHouseNames.has(edge.fromId.toLowerCase());
      const toMatches = representedHouseIds.has(edge.toId) || representedHouseNames.has(edge.toId.toLowerCase());

      if (fromMatches && toMatches && edge.fromId !== edge.toId) {
        const fromHouse = storage.houses.find(
          (h) => h.campaignId === activeCampaignId && (h.id === edge.fromId || h.name.toLowerCase() === edge.fromId.toLowerCase())
        );
        const toHouse = storage.houses.find(
          (h) => h.campaignId === activeCampaignId && (h.id === edge.toId || h.name.toLowerCase() === edge.toId.toLowerCase())
        );
        const fromName = fromHouse ? fromHouse.name : edge.fromId;
        const toName = toHouse ? toHouse.name : edge.toId;

        if (!processedPairs.has(edge.pairId)) {
          processedPairs.add(edge.pairId);
          inRoomRelationships.push({
            from: `House ${fromName}`,
            to: `House ${toName}`,
            type: edge.type,
            note: edge.note,
          });
        }
      }
    }
  }

  // Active in-room grudges (resolving target IDs or names across characters and houses)
  const inRoomGrudges: any[] = [];
  for (const char of resolvedCast) {
    for (const grudge of char.activeGrudges || []) {
      const resolvedTarget = resolveEntityRef(storage, activeCampaignId, 'any', grudge.targetId);
      const targetChars = resolvedCast.filter(
        (c) =>
          c.id === grudge.targetId ||
          c.id === resolvedTarget ||
          c.name.toLowerCase() === grudge.targetId.toLowerCase() ||
          (c.house && (() => {
            const cOwnHouse = storage.houses.find(
              (h) => h.campaignId === activeCampaignId && (h.id === c.house || h.name.toLowerCase() === c.house!.toLowerCase())
            );
            return (
              c.house.toLowerCase() === grudge.targetId.toLowerCase() ||
              c.house.toLowerCase() === resolvedTarget.toLowerCase() ||
              (cOwnHouse && (cOwnHouse.id === resolvedTarget || cOwnHouse.name.toLowerCase() === resolvedTarget.toLowerCase()))
            );
          })())
      );

      for (const targetChar of targetChars) {
        inRoomGrudges.push({
          holder: char.name,
          target: targetChar.name,
          intensity: grudge.intensity || 'bitter',
          reason: grudge.reason,
          date: grudge.date,
        });
      }
    }
  }

  // 4. Compute the Intrigue Matrix (Excludes exposed secrets - only hidden buried/whispered truths generate leverage)
  const activeLeverage: any[] = [];
  const sharedConspiracies: any[] = [];
  const hiddenBlindSpots: any[] = [];
  const unbeknownstToPov: string[] = [];

  const relevantSecrets = storage.secrets.filter(
    (s) =>
      s.campaignId === activeCampaignId &&
      (s.status === 'buried' || s.status === 'whispered') &&
      (s.subjectIds.some((id) => castIds.includes(id) || representedHouseIds.has(id) || representedHouseNames.has(id.toLowerCase())) ||
        s.knownByCharacterIds.some((id) => castIds.includes(id)) ||
        s.suspectedByCharacterIds.some((id) => castIds.includes(id)))
  );

  for (const s of relevantSecrets) {
    const knownInRoom = s.knownByCharacterIds.filter((id) => castIds.includes(id));
    const suspectedInRoom = s.suspectedByCharacterIds.filter((id) => castIds.includes(id));
    const subjectsInRoom = resolvedCast
      .filter((c) => {
        if (s.subjectIds.includes(c.id)) return true;
        if (c.house) {
          const cHouse = storage.houses.find(
            (h) => h.campaignId === activeCampaignId && (h.id === c.house || h.name.toLowerCase() === c.house!.toLowerCase())
          );
          const houseMatch = s.subjectIds.some((sid) => {
            const sidLower = sid.toLowerCase();
            return (
              sid === c.house ||
              sidLower === c.house!.toLowerCase() ||
              (cHouse && (sid === cHouse.id || sidLower === cHouse.name.toLowerCase()))
            );
          });
          if (houseMatch) return true;
        }
        return false;
      })
      .map((c) => c.id);

    // Shared conspiracy: 2 or more characters in the room share knowledge
    if (knownInRoom.length >= 2) {
      sharedConspiracies.push({
        secretId: s.id,
        title: s.title,
        severity: s.severity,
        status: s.status,
        conspirators: knownInRoom.map((id) => resolvedCast.find((c) => c.id === id)?.name || id),
        subtext: 'Share coded glances, aligned stakes, or mutual liability.',
      });
    }

    // Active leverage: Cast Member A knows or suspects a secret where Cast Member B is a subject
    for (const knowerId of knownInRoom) {
      for (const subjId of subjectsInRoom) {
        if (knowerId !== subjId) {
          const knower = resolvedCast.find((c) => c.id === knowerId);
          const subject = resolvedCast.find((c) => c.id === subjId);
          activeLeverage.push({
            holder: knower?.name || knowerId,
            target: subject?.name || subjId,
            relationship: 'knows_truth',
            secretTitle: s.title,
            severity: s.severity,
            leverageNote: s.leverageNote || 'Holds direct proof or knowledge over counterpart.',
          });
        }
      }
    }

    for (const suspecterId of suspectedInRoom) {
      for (const subjId of subjectsInRoom) {
        if (suspecterId !== subjId && !knownInRoom.includes(suspecterId)) {
          const suspecter = resolvedCast.find((c) => c.id === suspecterId);
          const subject = resolvedCast.find((c) => c.id === subjId);
          activeLeverage.push({
            holder: suspecter?.name || suspecterId,
            target: subject?.name || subjId,
            relationship: 'suspects',
            secretTitle: s.title,
            severity: s.severity,
            leverageNote: s.leverageNote || 'Harbors active suspicion without definitive proof.',
          });
        }
      }
    }

    // Hidden blind spot: Subject in the room, but NO other cast member in the room knows or suspects it
    if (subjectsInRoom.length > 0 && knownInRoom.length === 0 && suspectedInRoom.length === 0) {
      if (input.includeOmniscientSecrets) {
        hiddenBlindSpots.push({
          secretId: s.id,
          title: s.title,
          severity: s.severity,
          subject: resolvedCast.find((c) => c.id === subjectsInRoom[0])?.name || subjectsInRoom[0],
          note: 'Unexposed secret; nobody in the room is aware.',
        });
      }
    }

    // Check POV awareness for anti-metagaming guardrail
    if (resolvedPovId) {
      const povKnows = s.knownByCharacterIds.includes(resolvedPovId);
      const povSuspects = s.suspectedByCharacterIds.includes(resolvedPovId);

      if (!povKnows && !povSuspects) {
        unbeknownstToPov.push(s.title);
      }
    }
  }

  let gmGuardrail: string | undefined = undefined;
  if (povCharacter && unbeknownstToPov.length > 0) {
    gmGuardrail = `${povCharacter.name} does NOT know: [${unbeknownstToPov.map((t) => `'${t}'`).join(', ')}]. Play them as genuinely unaware of these hidden truths.`;
  } else if (resolvedPovId && unbeknownstToPov.length > 0) {
    gmGuardrail = `POV character (${resolvedPovId}) does NOT know: [${unbeknownstToPov.map((t) => `'${t}'`).join(', ')}].`;
  }

  const intrigueMatrix = {
    povCharacter: povCharacter ? povCharacter.name : resolvedPovId,
    gmGuardrail,
    activeLeverage,
    sharedConspiracies,
    hiddenBlindSpots,
  };

  // 5. Relevant Plot Threads
  const relevantThreads = storage.threads
    .filter(
      (t) =>
        t.campaignId === activeCampaignId &&
        t.status === 'open' &&
        t.relatedCharacterIds.some((id) => castIds.includes(id))
    )
    .slice(0, 3)
    .map((t) => ({
      id: t.id,
      title: t.title,
      summary: t.summary.length > 150 ? t.summary.slice(0, 150) + '...' : t.summary,
    }));

  // 6. Relevant Voices (Primary-source Tomes)
  const locLower = input.locationName ? input.locationName.toLowerCase() : '';
  const castNamesLower = resolvedCast.map((c) => c.name.toLowerCase());

  const matchingTomes = storage.tomes.filter((t) => {
    if (t.campaignId !== activeCampaignId) return false;
    const matchChar = (t.relatedCharacterIds || []).some((id) => castIds.includes(id));
    const matchTag = t.tags.some(
      (tg) =>
        castNamesLower.includes(tg.toLowerCase()) ||
        (locLower && tg.toLowerCase().includes(locLower))
    );
    const matchLoc = locLower && t.title.toLowerCase().includes(locLower);
    return matchChar || matchTag || matchLoc;
  });

  const candidateVoices = matchingTomes.length > 0
    ? matchingTomes
    : storage.tomes.filter((t) => t.campaignId === activeCampaignId && t.sourceType !== 'chronicle');

  // Prioritize primary sources (rumor, ballad, letter, prophecy)
  const sortedVoices = [...candidateVoices].sort((a, b) => {
    const aPri = a.sourceType && a.sourceType !== 'chronicle' ? 1 : 0;
    const bPri = b.sourceType && b.sourceType !== 'chronicle' ? 1 : 0;
    if (aPri !== bPri) return bPri - aPri;
    return b.createdAt - a.createdAt;
  });

  const localVoices = sortedVoices.slice(0, 3).map((t) => ({
    title: t.title,
    sourceType: t.sourceType || 'chronicle',
    inWorldAuthor: t.inWorldAuthor || 'Anonymous',
    reliability: t.reliability || 'true',
    gist: t.content.length > 130 ? t.content.slice(0, 130) + '...' : t.content,
  }));

  // 7. Scene Context & Atmosphere
  const sceneContext = {
    date: campaign.currentDate,
    era: campaign.currentEra,
    setting: campaign.setting,
    location: input.locationName,
    atmosphere: campaign.realmMood?.atmosphere,
    stability: campaign.realmMood?.stability,
    seasonOrWeather: campaign.realmMood?.seasonOrWeather,
    smallfolkWhispers: campaign.realmMood?.smallfolkWhispers || [],
  };

  return {
    success: true,
    sceneContext,
    cast,
    inRoomRelationships,
    inRoomGrudges,
    intrigueMatrix,
    relevantThreads,
    localVoices,
    unregisteredCharacters,
  };
}
