import { Storage } from '../storage.js';

export interface SearchResult {
  id: string;
  titleOrName: string;
  section: 'characters' | 'timeline' | 'tomes' | 'threads' | 'houses' | 'secrets';
  excerpt: string;
  matchedFields: string[];
}

function extractExcerpt(fullText: string, query: string, maxLength: number = 150): string {
  if (!fullText) return '';
  const lowerText = fullText.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);

  if (matchIndex === -1) {
    return fullText.length > maxLength ? fullText.slice(0, maxLength) + '...' : fullText;
  }

  const start = Math.max(0, matchIndex - 40);
  const end = Math.min(fullText.length, matchIndex + query.length + 110);

  let snippet = fullText.slice(start, end).replace(/\s+/g, ' ');
  if (start > 0) snippet = '...' + snippet;
  if (end < fullText.length) snippet = snippet + '...';
  return snippet;
}

export function searchChronicle(
  storage: Storage,
  query: string,
  sectionsOrOptions?:
    | ('characters' | 'timeline' | 'tomes' | 'threads' | 'houses' | 'secrets')[]
    | { sections?: ('characters' | 'timeline' | 'tomes' | 'threads' | 'houses' | 'secrets')[]; includeSecrets?: boolean },
  includeSecrets: boolean = true
) {
  let sections: ('characters' | 'timeline' | 'tomes' | 'threads' | 'houses' | 'secrets')[] = [
    'characters',
    'timeline',
    'tomes',
    'threads',
    'houses',
    'secrets',
  ];
  let incSecrets = includeSecrets;

  if (Array.isArray(sectionsOrOptions)) {
    sections = sectionsOrOptions;
  } else if (sectionsOrOptions && typeof sectionsOrOptions === 'object') {
    if (Array.isArray(sectionsOrOptions.sections)) {
      sections = sectionsOrOptions.sections;
    }
    if (sectionsOrOptions.includeSecrets !== undefined) {
      incSecrets = sectionsOrOptions.includeSecrets;
    }
  }

  const activeId = storage.activeCampaignId;
  const queryTrimmed = query.trim();
  if (!queryTrimmed) {
    return {
      success: true,
      results: { characters: [], timeline: [], tomes: [], threads: [], houses: [], secrets: [] },
    };
  }

  const qLower = queryTrimmed.toLowerCase();
  const results: {
    characters: SearchResult[];
    timeline: SearchResult[];
    tomes: SearchResult[];
    threads: SearchResult[];
    houses: SearchResult[];
    secrets: SearchResult[];
  } = {
    characters: [],
    timeline: [],
    tomes: [],
    threads: [],
    houses: [],
    secrets: [],
  };

  if (sections.includes('characters')) {
    const chars = storage.characters.filter((c) => c.campaignId === activeId);
    for (const c of chars) {
      const matchedFields: string[] = [];
      const primaryText = c.coreDrive || c.flaw || c.relationships || c.trajectory || c.face || c.voice || c.name;

      if (c.name.toLowerCase().includes(qLower)) matchedFields.push('name');
      if (c.house && c.house.toLowerCase().includes(qLower)) matchedFields.push('house');
      if (c.tags.some((t) => t.toLowerCase().includes(qLower))) matchedFields.push('tags');
      if (c.face && c.face.toLowerCase().includes(qLower)) matchedFields.push('face');
      if (c.voice && c.voice.toLowerCase().includes(qLower)) matchedFields.push('voice');
      if (c.coreDrive && c.coreDrive.toLowerCase().includes(qLower)) matchedFields.push('coreDrive');
      if (c.flaw && c.flaw.toLowerCase().includes(qLower)) matchedFields.push('flaw');
      if (c.modernAnalogue && c.modernAnalogue.toLowerCase().includes(qLower)) matchedFields.push('modernAnalogue');
      if (c.relationships && c.relationships.toLowerCase().includes(qLower)) matchedFields.push('relationships');
      if (c.trajectory && c.trajectory.toLowerCase().includes(qLower)) matchedFields.push('trajectory');
      if (c.historyLog && c.historyLog.some((h) => h.note.toLowerCase().includes(qLower))) matchedFields.push('historyLog');

      if (matchedFields.length > 0) {
        results.characters.push({
          id: c.id,
          titleOrName: c.name,
          section: 'characters',
          excerpt: extractExcerpt(primaryText, queryTrimmed),
          matchedFields,
        });

        if (results.characters.length >= 15) break;
      }
    }
  }

  if (sections.includes('timeline')) {
    const timeline = storage.timeline.filter((e) => e.campaignId === activeId);
    for (const e of timeline) {
      const matchedFields: string[] = [];
      if (e.title.toLowerCase().includes(qLower)) matchedFields.push('title');
      if (e.date && e.date.toLowerCase().includes(qLower)) matchedFields.push('date');
      if (e.tags.some((t) => t.toLowerCase().includes(qLower))) matchedFields.push('tags');
      if (e.narrative.toLowerCase().includes(qLower)) matchedFields.push('narrative');
      if (e.mechanicalOutcome && e.mechanicalOutcome.summary.toLowerCase().includes(qLower)) matchedFields.push('mechanicalOutcome');

      if (matchedFields.length > 0) {
        const textForExcerpt = e.narrative.toLowerCase().includes(qLower) ? e.narrative : `${e.title} (${e.date || ''}) ${e.narrative}`;
        results.timeline.push({
          id: e.id,
          titleOrName: e.title,
          section: 'timeline',
          excerpt: extractExcerpt(textForExcerpt, queryTrimmed),
          matchedFields,
        });

        if (results.timeline.length >= 15) break;
      }
    }
  }

  if (sections.includes('tomes')) {
    const tomes = storage.tomes.filter((t) => t.campaignId === activeId);
    for (const t of tomes) {
      const matchedFields: string[] = [];
      if (t.title.toLowerCase().includes(qLower)) matchedFields.push('title');
      if (t.category && t.category.toLowerCase().includes(qLower)) matchedFields.push('category');
      if (t.tags.some((tg) => tg.toLowerCase().includes(qLower))) matchedFields.push('tags');
      if (t.content.toLowerCase().includes(qLower)) matchedFields.push('content');

      if (matchedFields.length > 0) {
        const textForExcerpt = t.content.toLowerCase().includes(qLower) ? t.content : `${t.title} - ${t.content}`;
        results.tomes.push({
          id: t.id,
          titleOrName: t.title,
          section: 'tomes',
          excerpt: extractExcerpt(textForExcerpt, queryTrimmed),
          matchedFields,
        });

        if (results.tomes.length >= 15) break;
      }
    }
  }

  if (sections.includes('threads')) {
    const threads = storage.threads.filter((th) => th.campaignId === activeId);
    for (const th of threads) {
      const matchedFields: string[] = [];
      if (th.title.toLowerCase().includes(qLower)) matchedFields.push('title');
      if (th.summary.toLowerCase().includes(qLower)) matchedFields.push('summary');
      if (th.tags.some((t) => t.toLowerCase().includes(qLower))) matchedFields.push('tags');

      if (matchedFields.length > 0) {
        results.threads.push({
          id: th.id,
          titleOrName: th.title,
          section: 'threads',
          excerpt: extractExcerpt(th.summary, queryTrimmed),
          matchedFields,
        });

        if (results.threads.length >= 15) break;
      }
    }
  }

  if (sections.includes('houses')) {
    const houses = storage.houses.filter((h) => h.campaignId === activeId);
    for (const h of houses) {
      const matchedFields: string[] = [];
      if (h.name.toLowerCase().includes(qLower)) matchedFields.push('name');
      if (h.holdings && h.holdings.some((hl) => hl.toLowerCase().includes(qLower))) matchedFields.push('holdings');
      if (h.tags.some((t) => t.toLowerCase().includes(qLower))) matchedFields.push('tags');
      if (h.historyLog && h.historyLog.some((hl) => hl.note.toLowerCase().includes(qLower))) matchedFields.push('historyLog');

      if (matchedFields.length > 0) {
        const textForExcerpt = `${h.name} (${h.status} house) ${h.holdings ? h.holdings.join(', ') : ''}`;
        results.houses.push({
          id: h.id,
          titleOrName: h.name,
          section: 'houses',
          excerpt: extractExcerpt(textForExcerpt, queryTrimmed),
          matchedFields,
        });

        if (results.houses.length >= 15) break;
      }
    }
  }

  if (sections.includes('secrets')) {
    const secrets = storage.secrets.filter((s) => s.campaignId === activeId);
    for (const s of secrets) {
      if (!incSecrets && s.status !== 'exposed') {
        continue;
      }
      const matchedFields: string[] = [];
      if (s.title.toLowerCase().includes(qLower)) matchedFields.push('title');
      if (s.truth.toLowerCase().includes(qLower)) matchedFields.push('truth');
      if (s.publicCoverStory && s.publicCoverStory.toLowerCase().includes(qLower)) matchedFields.push('publicCoverStory');
      if (s.leverageNote && s.leverageNote.toLowerCase().includes(qLower)) matchedFields.push('leverageNote');
      if (s.tags.some((t) => t.toLowerCase().includes(qLower))) matchedFields.push('tags');
      if (s.historyLog && s.historyLog.some((hl) => hl.note.toLowerCase().includes(qLower))) matchedFields.push('historyLog');

      if (matchedFields.length > 0) {
        const textForExcerpt = s.publicCoverStory ? `${s.title}: ${s.publicCoverStory} [Truth: ${s.truth}]` : `${s.title}: ${s.truth}`;
        results.secrets.push({
          id: s.id,
          titleOrName: s.title,
          title: s.title,
          section: 'secrets',
          excerpt: extractExcerpt(textForExcerpt, queryTrimmed),
          matchedFields,
        } as any);

        if (results.secrets.length >= 15) break;
      }
    }
  }

  return { success: true, results };
}

export function getRealmRecap(storage: Storage, campaignId?: string) {
  const activeCampaign = campaignId
    ? (storage.campaigns.find((c) => c.id === campaignId) || storage.getActiveCampaign())
    : storage.getActiveCampaign();
  const activeId = activeCampaign.id;

  // 1. Campaign Pulse block
  let playerCharacterName: string | undefined = undefined;
  if (activeCampaign.playerCharacterId) {
    const pc = storage.characters.find(
      (c) => c.campaignId === activeId && c.id === activeCampaign.playerCharacterId
    );
    playerCharacterName = pc ? pc.name : activeCampaign.playerCharacterId;
  }

  const campaignPulse = {
    campaignName: activeCampaign.name,
    campaignId: activeCampaign.id,
    setting: activeCampaign.setting,
    currentDate: activeCampaign.currentDate,
    currentSortYear: activeCampaign.currentSortYear,
    currentEra: activeCampaign.currentEra,
    playerCharacter: playerCharacterName,
    realmMood: activeCampaign.realmMood,
  };

  // 2. Active Secrets Summary [GM EYES ONLY]
  const buriedOrWhispered = storage.secrets.filter(
    (s) => s.campaignId === activeId && (s.status === 'buried' || s.status === 'whispered')
  );
  const activeSecretsSummary = {
    flag: '[GM EYES ONLY]',
    count: buriedOrWhispered.length,
    secrets: buriedOrWhispered.map((s) => ({
      id: s.id,
      title: s.title,
      severity: s.severity,
      status: s.status,
    })),
  };

  // 3. Recent Voices (2-3 primary-source Tomes like ballads, letters, rumors)
  const nonChronicleTomes = storage.tomes.filter(
    (t) => t.campaignId === activeId && t.sourceType && t.sourceType !== 'chronicle'
  );
  const candidateTomes = nonChronicleTomes.length > 0 ? nonChronicleTomes : storage.tomes.filter((t) => t.campaignId === activeId);
  const sortedTomes = [...candidateTomes].sort((a, b) => b.createdAt - a.createdAt);
  const recentVoices = sortedTomes.slice(0, 3).map((t) => ({
    id: t.id,
    title: t.title,
    sourceType: t.sourceType || 'chronicle',
    inWorldAuthor: t.inWorldAuthor || 'Anonymous',
    inGameDate: t.inGameDate,
    reliability: t.reliability || 'true',
    gist: t.content.length > 140 ? t.content.slice(0, 140) + '...' : t.content,
  }));

  // 4. Recent events for active campaign
  const campaignEvents = storage.timeline.filter((e) => e.campaignId === activeId);
  const sortedEvents = [...campaignEvents].sort((a, b) => b.createdAt - a.createdAt);
  const recentEvents = sortedEvents.slice(0, 5).map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date || 'Unspecified date',
    gist: e.narrative.length > 120 ? e.narrative.slice(0, 120) + '...' : e.narrative,
  }));

  // 5. Active living characters for active campaign
  const aliveChars = storage.characters.filter(
    (c) => c.campaignId === activeId && c.status === 'alive'
  );
  const activeCharacters = {
    count: aliveChars.length,
    names: aliveChars.map((c) => (c.house ? `${c.name} of House ${c.house}` : c.name)),
  };

  // 6. Top tags across last 15 timeline events in active campaign
  const last15Events = sortedEvents.slice(0, 15);
  const tagCounts: Record<string, number> = {};
  for (const event of last15Events) {
    for (const tag of event.tags) {
      const normalizedTag = tag.trim();
      if (normalizedTag) {
        tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1;
      }
    }
  }

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  // 7. Open Plot Threads for active campaign
  const openThreads = storage.threads
    .filter((t) => t.campaignId === activeId && t.status === 'open')
    .map((t) => ({
      id: t.id,
      title: t.title,
      summary: t.summary,
    }));

  return {
    success: true,
    recap: {
      campaign: activeCampaign.name,
      campaignId: activeCampaign.id,
      campaignPulse,
      activeSecretsSummary,
      recentVoices,
      recentEvents,
      activeCharacters,
      topTags,
      openThreads,
    },
  };
}

export const buildRealmRecap = getRealmRecap;
