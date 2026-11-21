import { Storage } from '../storage.js';

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
