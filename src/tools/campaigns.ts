import { Storage, resolveCharacterRef } from '../storage.js';
import { RealmMood } from '../schema.js';

export function listCampaigns(storage: Storage) {
  const activeId = storage.activeCampaignId;
  const list = storage.campaigns.map((c) => {
    const characterCount = storage.characters.filter((ch) => ch.campaignId === c.id).length;
    const eventCount = storage.timeline.filter((e) => e.campaignId === c.id).length;
    const threadCount = storage.threads.filter((t) => t.campaignId === c.id).length;
    const houseCount = storage.houses.filter((h) => h.campaignId === c.id).length;

    return {
      id: c.id,
      name: c.name,
      isActive: c.id === activeId,
      createdAt: c.createdAt,
      lastActiveAt: c.lastActiveAt,
      stats: {
        characterCount,
        eventCount,
        threadCount,
        houseCount,
      },
    };
  });

  return {
    success: true,
    count: list.length,
    activeCampaignId: activeId,
    campaigns: list,
  };
}

export function createCampaign(storage: Storage, name: string) {
  return storage.createCampaign(name);
}

export function setActiveCampaign(storage: Storage, nameOrId: string) {
  return storage.setActiveCampaign(nameOrId);
}

export function getActiveCampaign(storage: Storage) {
  const campaign = storage.getActiveCampaign();
  return {
    success: true,
    campaign,
  };
}

export function updateRealmPulse(
  storage: Storage,
  params: {
    campaignId?: string;
    setting?: string;
    currentDate?: string;
    currentSortYear?: number;
    currentEra?: string;
    playerCharacterId?: string;
    realmMood?: Partial<RealmMood>;
    addWhisper?: string;
    retireWhisper?: string;
    addCrisis?: string;
    resolveCrisis?: string;
  }
) {
  const campaignId = params.campaignId || storage.activeCampaignId;
  const campaign = storage.campaigns.find((c) => c.id === campaignId);
  if (!campaign) {
    return { success: false, message: `Campaign '${campaignId}' not found.` };
  }

  if (params.setting !== undefined) campaign.setting = params.setting;
  if (params.currentDate !== undefined) campaign.currentDate = params.currentDate;
  if (params.currentSortYear !== undefined) campaign.currentSortYear = params.currentSortYear;
  if (params.currentEra !== undefined) campaign.currentEra = params.currentEra;
  if (params.playerCharacterId !== undefined) {
    campaign.playerCharacterId = resolveCharacterRef(storage, campaign.id, params.playerCharacterId);
  }

  if (params.realmMood) {
    campaign.realmMood = {
      atmosphere: params.realmMood.atmosphere ?? campaign.realmMood?.atmosphere ?? 'The winds shift across the realm.',
      stability: params.realmMood.stability ?? campaign.realmMood?.stability ?? 'uneasy',
      seasonOrWeather: params.realmMood.seasonOrWeather ?? campaign.realmMood?.seasonOrWeather,
      activeCrises: params.realmMood.activeCrises ?? campaign.realmMood?.activeCrises ?? [],
      smallfolkWhispers: params.realmMood.smallfolkWhispers ?? campaign.realmMood?.smallfolkWhispers ?? [],
    };
  }

  if (!campaign.realmMood && (params.addWhisper || params.retireWhisper || params.addCrisis || params.resolveCrisis)) {
    campaign.realmMood = {
      atmosphere: 'The winds whisper across the realm.',
      stability: 'uneasy',
      activeCrises: [],
      smallfolkWhispers: [],
    };
  }

  if (campaign.realmMood) {
    if (params.addWhisper) {
      if (!campaign.realmMood.smallfolkWhispers.includes(params.addWhisper)) {
        campaign.realmMood.smallfolkWhispers.push(params.addWhisper);
      }
    }
    if (params.retireWhisper) {
      const q = params.retireWhisper.toLowerCase();
      campaign.realmMood.smallfolkWhispers = campaign.realmMood.smallfolkWhispers.filter(
        (w) => !w.toLowerCase().includes(q)
      );
    }
    if (params.addCrisis) {
      if (!campaign.realmMood.activeCrises.includes(params.addCrisis)) {
        campaign.realmMood.activeCrises.push(params.addCrisis);
      }
    }
    if (params.resolveCrisis) {
      const q = params.resolveCrisis.toLowerCase();
      campaign.realmMood.activeCrises = campaign.realmMood.activeCrises.filter(
        (c) => !c.toLowerCase().includes(q)
      );
    }
  }

  campaign.lastActiveAt = Date.now();
  storage.scheduleWrite('campaigns');

  return {
    success: true,
    message: `Updated realm pulse for campaign '${campaign.name}'.`,
    campaign,
  };
}
