import { Storage } from '../storage.js';
import {
  RouteSkillInputSchema,
  GetSkillInputSchema,
  ListSkillsInputSchema,
} from '../schema.js';
import { loadAllSkills, getSkillById } from '../skills/loader.js';
import { routeSkill as executeRouteSkill } from '../skills/router.js';
import { z } from 'zod';

export function routeSkill(
  storage: Storage,
  input: z.infer<typeof RouteSkillInputSchema>,
  skillsDir?: string
) {
  return executeRouteSkill(storage, input, skillsDir);
}

export function listSkills(
  storage: Storage,
  input?: z.infer<typeof ListSkillsInputSchema>,
  skillsDir?: string
) {
  const activeCampaignId = input?.campaignId || storage.activeCampaignId;
  const campaign = storage.campaigns.find((c) => c.id === activeCampaignId) || storage.getActiveCampaign();
  const allSkills = loadAllSkills(skillsDir);

  const filteredSkills = allSkills.filter((s) => {
    if (input?.includeAllCampaigns) return true;
    if (!s.campaignScope || s.campaignScope.length === 0) return true;

    const campIdLower = campaign.id.toLowerCase();
    const campNameLower = campaign.name.toLowerCase();
    return s.campaignScope.some((scope) => {
      const scopeLower = scope.toLowerCase();
      return scopeLower === campIdLower || scopeLower === campNameLower;
    });
  });

  const compactList = filteredSkills.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    triggers: s.triggers.slice(0, 6),
    autoPrefetch: s.autoPrefetch,
    priority: s.priority,
    isCustom: s.isCustom,
    campaignScope: s.campaignScope,
    toolSequence: s.toolSequence,
  }));

  return {
    success: true,
    count: compactList.length,
    activeCampaign: campaign.name,
    activeCampaignId,
    skills: compactList,
  };
}

export function getSkill(
  storage: Storage,
  input: z.infer<typeof GetSkillInputSchema>,
  skillsDir?: string
) {
  const allSkills = loadAllSkills(skillsDir);
  const matched = allSkills.find((s) => s.id.toLowerCase() === input.skillId.trim().toLowerCase());

  if (!matched) {
    const available = allSkills.map((s) => s.id).join(', ');
    return {
      success: false,
      message: `Skill '${input.skillId}' not found. Available skills: [${available}]`,
    };
  }

  return {
    success: true,
    skill: matched,
  };
}
