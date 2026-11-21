import { Storage } from '../storage.js';

export interface SearchResult {
  id: string;
  titleOrName: string;
  section: 'characters' | 'timeline' | 'tomes' | 'threads' | 'houses';
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
  sections: ('characters' | 'timeline' | 'tomes' | 'threads' | 'houses')[] = [
    'characters',
    'timeline',
    'tomes',
    'threads',
    'houses',
  ]
) {
  const activeId = storage.activeCampaignId;
  const queryTrimmed = query.trim();
  if (!queryTrimmed) {
    return {
      success: true,
      results: { characters: [], timeline: [], tomes: [], threads: [], houses: [] },
    };
  }

  const qLower = queryTrimmed.toLowerCase();
  const results: {
    characters: SearchResult[];
    timeline: SearchResult[];
    tomes: SearchResult[];
    threads: SearchResult[];
    houses: SearchResult[];
  } = {
    characters: [],
    timeline: [],
    tomes: [],
    threads: [],
    houses: [],
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

  return { success: true, results };
}

export function getRealmRecap(storage: Storage) {
  const activeCampaign = storage.getActiveCampaign();
  const activeId = activeCampaign.id;

  // 1. Recent events for active campaign
  const campaignEvents = storage.timeline.filter((e) => e.campaignId === activeId);
  const sortedEvents = [...campaignEvents].sort((a, b) => b.createdAt - a.createdAt);
  const recentEvents = sortedEvents.slice(0, 5).map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date || 'Unspecified date',
    gist: e.narrative.length > 120 ? e.narrative.slice(0, 120) + '...' : e.narrative,
  }));

  // 2. Active living characters for active campaign
  const aliveChars = storage.characters.filter(
    (c) => c.campaignId === activeId && c.status === 'alive'
  );
  const activeCharacters = {
    count: aliveChars.length,
    names: aliveChars.map((c) => (c.house ? `${c.name} of House ${c.house}` : c.name)),
  };

  // 3. Top tags across last 15 timeline events in active campaign
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

  // 4. Open Plot Threads for active campaign
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
      recentEvents,
      activeCharacters,
      topTags,
      openThreads,
    },
  };
}
