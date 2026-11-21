import { Storage, resolveCharacterRef, attachComputedAge } from '../storage.js';
import { RouteSkillInputSchema, SkillDefinition } from '../schema.js';
import { loadAllSkills, getSkillById } from './loader.js';
import { buildSceneBriefing } from '../tools/director.js';
import { buildRealmRecap } from '../tools/campaigns.js';
import { z } from 'zod';

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractDirectives(playbook: string, maxDirectives = 3): string[] {
  const match = playbook.match(/## Mode Directives\s*([\s\S]*?)(?=\n##|\s*$)/i);
  if (!match) return [];
  const lines = match[1].split(/\r?\n/);
  const directives: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      directives.push(trimmed.slice(2).trim());
      if (directives.length >= maxDirectives) break;
    }
  }
  return directives;
}

export interface ScoredSkill {
  skill: SkillDefinition;
  score: number;
  matchedTriggers: string[];
  matchedAntiTriggers: string[];
  worldStateBoosts: string[];
}

export interface RouteSkillResult {
  success: boolean;
  primarySkill: {
    id: string;
    name: string;
    description: string;
    autoPrefetch: string;
    toolSequence: string[];
    playbook: string;
  };
  secondaryBlend?: {
    id: string;
    name: string;
    directives: string[];
  };
  remainingRecommendedTools: string[];
  prefetchNotice?: string;
  prefetchedContext?: {
    sceneBriefing?: any;
    realmRecap?: any;
    publicArchiveHint?: string;
  };
  routingTrace: {
    selectedId: string;
    score: number;
    matchedTriggers: string[];
    worldStateBoosts: string[];
    runnerUp: {
      id: string;
      score: number;
      blended: boolean;
    } | null;
  };
}

export function routeSkill(
  storage: Storage,
  input: z.infer<typeof RouteSkillInputSchema>,
  skillsDir?: string
): RouteSkillResult {
  const activeCampaignId = input.campaignId || storage.activeCampaignId;
  const campaign = storage.campaigns.find((c) => c.id === activeCampaignId) || storage.getActiveCampaign();
  const allSkills = loadAllSkills(skillsDir);

  const rawIntent = (input.intent || '').trim();
  const normalizedIntent = rawIntent.toLowerCase();

  // Resolve cast characters for world-state checks
  const resolvedCastIds: string[] = [];
  const resolvedCast: any[] = [];
  for (const rawRef of input.characterIds || []) {
    const canonicalId = resolveCharacterRef(storage, activeCampaignId, rawRef);
    if (!resolvedCastIds.includes(canonicalId)) {
      resolvedCastIds.push(canonicalId);
      const char = storage.characters.find((c) => c.campaignId === activeCampaignId && c.id === canonicalId);
      if (char) {
        resolvedCast.push(attachComputedAge(char, campaign));
      }
    }
  }

  // 1. Direct Override Check (@skill-id or exact skill-id)
  let directOverrideSkill: SkillDefinition | null = null;
  for (const skill of allSkills) {
    const skillIdLower = skill.id.toLowerCase();
    if (
      normalizedIntent === skillIdLower ||
      normalizedIntent === '@' + skillIdLower ||
      normalizedIntent.startsWith('@' + skillIdLower + ' ') ||
      normalizedIntent === '@' + skillIdLower.replace(/-/g, '_')
    ) {
      directOverrideSkill = skill;
      break;
    }
  }

  if (directOverrideSkill) {
    const primary = directOverrideSkill;
    const remainingTools = [...primary.toolSequence];
    let prefetchNotice: string | undefined = undefined;
    const prefetchedContext: Record<string, any> = {};

    if (input.autoBrief) {
      if (primary.autoPrefetch === 'scene_briefing') {
        prefetchedContext.sceneBriefing = buildSceneBriefing(storage, {
          characterIds: input.characterIds || [],
          locationName: input.locationName,
          povCharacterId: input.povCharacterId,
          includeOmniscientSecrets: true,
          campaignId: activeCampaignId,
        });
        prefetchNotice =
          'sceneBriefing is ALREADY attached below. Do NOT call get_scene_briefing again for this scene.';
        const idx = remainingTools.indexOf('get_scene_briefing');
        if (idx !== -1) remainingTools.splice(idx, 1);
      } else if (primary.autoPrefetch === 'realm_recap') {
        prefetchedContext.realmRecap = buildRealmRecap(storage, activeCampaignId);
        prefetchNotice =
          'realmRecap is ALREADY attached below. Do NOT call get_realm_recap again for this scene.';
        const idx = remainingTools.indexOf('get_realm_recap');
        if (idx !== -1) remainingTools.splice(idx, 1);
      } else if (primary.autoPrefetch === 'public_archive_hint') {
        prefetchedContext.publicArchiveHint =
          'Maester Mode active: Rely on recorded Tomes and open timeline facts. Avoid omniscience.';
      }
    }

    return {
      success: true,
      primarySkill: {
        id: primary.id,
        name: primary.name,
        description: primary.description,
        autoPrefetch: primary.autoPrefetch,
        toolSequence: primary.toolSequence,
        playbook: primary.playbook,
      },
      remainingRecommendedTools: remainingTools,
      prefetchNotice,
      prefetchedContext: Object.keys(prefetchedContext).length > 0 ? prefetchedContext : undefined,
      routingTrace: {
        selectedId: primary.id,
        score: 1000,
        matchedTriggers: [`@${primary.id} direct override`],
        worldStateBoosts: [],
        runnerUp: null,
      },
    };
  }

  // 2. Pre-calculate Live World-State Boosts
  const worldBoostsMap: Record<string, { score: number; reason: string }[]> = {};
  const addBoost = (skillId: string, score: number, reason: string) => {
    if (!worldBoostsMap[skillId]) worldBoostsMap[skillId] = [];
    worldBoostsMap[skillId].push({ score, reason });
  };

  // Boost: Secret Heat (+8 to court-intrigue)
  if (resolvedCastIds.length > 0) {
    const touchingSecrets = storage.secrets.filter((s) => {
      if (s.campaignId !== activeCampaignId) return false;
      if (s.status !== 'buried' && s.status !== 'whispered') return false;
      const allTouch = [...s.subjectIds, ...s.knownByCharacterIds, ...s.suspectedByCharacterIds];
      return allTouch.some((id) => resolvedCastIds.includes(id));
    });

    if (touchingSecrets.length > 0) {
      addBoost(
        'court-intrigue',
        8,
        `+8 Secret Heat: ${touchingSecrets.length} active secrets touch cast members`
      );
    }
  }

  // Boost: Relational Friction (+5 to diplomacy-and-oaths)
  if (resolvedCastIds.length > 0) {
    let hasGrudge = false;
    for (const castId of resolvedCastIds) {
      const char = storage.characters.find((c) => c.campaignId === activeCampaignId && c.id === castId);
      if (char?.activeGrudges && char.activeGrudges.length > 0) {
        for (const g of char.activeGrudges) {
          const resolvedTarget = resolveCharacterRef(storage, activeCampaignId, g.targetId);
          if (resolvedCastIds.includes(resolvedTarget)) {
            hasGrudge = true;
            break;
          }
        }
      }
      if (hasGrudge) break;
    }

    let hasFrictionEdge = false;
    for (const edge of storage.relationships) {
      if (edge.campaignId !== activeCampaignId) continue;
      if (
        (edge.type === 'rival' || edge.type === 'enemy' || (edge.sentiment !== undefined && edge.sentiment < -10)) &&
        resolvedCastIds.includes(edge.fromId) &&
        resolvedCastIds.includes(edge.toId)
      ) {
        hasFrictionEdge = true;
        break;
      }
    }

    if (hasGrudge || hasFrictionEdge) {
      addBoost(
        'diplomacy-and-oaths',
        5,
        '+5 Relational Friction: Grudge or rival/enemy ties between cast members'
      );
    }
  }

  // Boost: Succession Pressure (+6 to dynasty-and-succession)
  const stability = campaign.realmMood?.stability;
  const isVolatile = stability === 'volatile' || stability === 'fracturing';
  const hasElderly = resolvedCast.some((c) => {
    const age = c.computedAge ?? c.ageAtDeath;
    return typeof age === 'number' && age >= 55;
  });
  const successionKeywords = ['heir', 'crown', 'death', 'old', 'regent', 'succession', 'sick'];
  const mentionsSuccession = successionKeywords.some((kw) => normalizedIntent.includes(kw));

  if ((isVolatile || hasElderly) && mentionsSuccession) {
    addBoost(
      'dynasty-and-succession',
      6,
      '+6 Succession Pressure: Volatile realm/elder cast + succession intent'
    );
  }

  // Boost: Time / Mood Shift (+5 to post-scene-chronicle)
  const timeKeywords = [
    'years later',
    'skip',
    'wrap up',
    'end session',
    'recap changes',
    'log what happened',
    'timeskip',
    'post scene',
    'debrief',
  ];
  if (timeKeywords.some((kw) => normalizedIntent.includes(kw))) {
    addBoost(
      'post-scene-chronicle',
      5,
      '+5 Time / Mood Shift: Concluding beat or timeskip keyword in intent'
    );
  }

  // 3. Score Candidates in a single deterministic pass
  const scoredCandidates: ScoredSkill[] = [];

  for (const skill of allSkills) {
    // Campaign Scope Gate
    if (skill.campaignScope && skill.campaignScope.length > 0) {
      const campIdLower = campaign.id.toLowerCase();
      const campNameLower = campaign.name.toLowerCase();
      const inScope = skill.campaignScope.some((scope) => {
        const sLower = scope.toLowerCase();
        return sLower === campIdLower || sLower === campNameLower;
      });
      if (!inScope) {
        continue;
      }
    }

    let score = 0;
    const matchedTriggers: string[] = [];
    const matchedAntiTriggers: string[] = [];
    const worldStateBoosts: string[] = [];

    // Lexical triggers
    for (const trigger of skill.triggers) {
      const trigLower = trigger.toLowerCase();
      if (trigLower.includes(' ')) {
        // Multi-word phrase: +14
        if (normalizedIntent.includes(trigLower)) {
          score += 14;
          matchedTriggers.push(`"${trigger}" (+14)`);
        }
      } else {
        // Single-word whole-word match: +7
        const wordRegex = new RegExp(`\\b${escapeRegExp(trigLower)}\\b`, 'i');
        if (wordRegex.test(normalizedIntent)) {
          score += 7;
          matchedTriggers.push(`"${trigger}" (+7)`);
        } else if (trigLower.length >= 5) {
          // Substring stem match for words >= 5 chars: +4
          const stem = trigLower.length > 7 ? trigLower.slice(0, 7) : trigLower;
          if (normalizedIntent.includes(stem)) {
            score += 4;
            matchedTriggers.push(`stem "${stem}" (+4)`);
          }
        }
      }
    }

    // Lexical antiTriggers: -12
    for (const anti of skill.antiTriggers) {
      const antiLower = anti.toLowerCase();
      if (antiLower.includes(' ')) {
        if (normalizedIntent.includes(antiLower)) {
          score -= 12;
          matchedAntiTriggers.push(`"${anti}" (-12)`);
        }
      } else {
        const wordRegex = new RegExp(`\\b${escapeRegExp(antiLower)}\\b`, 'i');
        if (wordRegex.test(normalizedIntent) || normalizedIntent.includes(antiLower)) {
          score -= 12;
          matchedAntiTriggers.push(`"${anti}" (-12)`);
        }
      }
    }

    // World-state boosts
    const skillBoosts = worldBoostsMap[skill.id] || [];
    for (const b of skillBoosts) {
      score += b.score;
      worldStateBoosts.push(b.reason);
    }

    // Priority tie-breaker: +0.1 * priority
    score += (skill.priority || 0) * 0.1;

    scoredCandidates.push({
      skill,
      score,
      matchedTriggers,
      matchedAntiTriggers,
      worldStateBoosts,
    });
  }

  // Sort scored candidates descending
  scoredCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.skill.id.localeCompare(b.skill.id);
  });

  // Fallback selection if top score <= 1
  let primaryCandidate = scoredCandidates[0];
  let isFallback = false;

  if (!primaryCandidate || primaryCandidate.score <= 1) {
    isFallback = true;
    const fallbackId = (input.characterIds && input.characterIds.length > 0)
      ? 'world-texture-and-tavern'
      : 'session-bootstrap';

    const fallbackSkill = allSkills.find((s) => s.id === fallbackId) || allSkills[0];
    primaryCandidate = {
      skill: fallbackSkill,
      score: 1,
      matchedTriggers: ['fallback selection'],
      matchedAntiTriggers: [],
      worldStateBoosts: [],
    };
  }

  const primary = primaryCandidate.skill;
  const remainingTools = [...primary.toolSequence];
  let prefetchNotice: string | undefined = undefined;
  const prefetchedContext: Record<string, any> = {};

  // Secondary Blend
  let secondaryBlend: { id: string; name: string; directives: string[] } | undefined = undefined;
  const secondCandidate = scoredCandidates.length > 1 ? scoredCandidates[1] : null;

  if (
    input.includeSecondary &&
    !isFallback &&
    secondCandidate &&
    secondCandidate.skill.id !== primary.id
  ) {
    const score1 = primaryCandidate.score;
    const score2 = secondCandidate.score;

    if (score2 >= 10 && score2 >= score1 * 0.65 && score1 < 1000) {
      const directives = extractDirectives(secondCandidate.skill.playbook, 3);
      if (directives.length > 0) {
        secondaryBlend = {
          id: secondCandidate.skill.id,
          name: secondCandidate.skill.name,
          directives,
        };
      }
    }
  }

  // Auto-Prefetch Chaining
  if (input.autoBrief) {
    if (primary.autoPrefetch === 'scene_briefing') {
      prefetchedContext.sceneBriefing = buildSceneBriefing(storage, {
        characterIds: input.characterIds || [],
        locationName: input.locationName,
        povCharacterId: input.povCharacterId,
        includeOmniscientSecrets: true,
        campaignId: activeCampaignId,
      });
      prefetchNotice =
        'sceneBriefing is ALREADY attached below. Do NOT call get_scene_briefing again for this scene.';
      const idx = remainingTools.indexOf('get_scene_briefing');
      if (idx !== -1) remainingTools.splice(idx, 1);
    } else if (primary.autoPrefetch === 'realm_recap') {
      prefetchedContext.realmRecap = buildRealmRecap(storage, activeCampaignId);
      prefetchNotice =
        'realmRecap is ALREADY attached below. Do NOT call get_realm_recap again for this scene.';
      const idx = remainingTools.indexOf('get_realm_recap');
      if (idx !== -1) remainingTools.splice(idx, 1);
    } else if (primary.autoPrefetch === 'public_archive_hint') {
      prefetchedContext.publicArchiveHint =
        'Maester Mode active: Rely on recorded Tomes and open timeline facts. Avoid omniscience.';
    }
  }

  return {
    success: true,
    primarySkill: {
      id: primary.id,
      name: primary.name,
      description: primary.description,
      autoPrefetch: primary.autoPrefetch,
      toolSequence: primary.toolSequence,
      playbook: primary.playbook,
    },
    secondaryBlend,
    remainingRecommendedTools: remainingTools,
    prefetchNotice,
    prefetchedContext: Object.keys(prefetchedContext).length > 0 ? prefetchedContext : undefined,
    routingTrace: {
      selectedId: primary.id,
      score: primaryCandidate.score,
      matchedTriggers: primaryCandidate.matchedTriggers,
      worldStateBoosts: primaryCandidate.worldStateBoosts,
      runnerUp: secondCandidate
        ? {
            id: secondCandidate.skill.id,
            score: secondCandidate.score,
            blended: Boolean(secondaryBlend),
          }
        : null,
    },
  };
}
