import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { Storage } from './storage.js';
import {
  listCampaigns,
  createCampaign,
  setActiveCampaign,
  getActiveCampaign,
  updateRealmPulse,
} from './tools/campaigns.js';
import {
  listCharacters,
  getCharacter,
  findCharacterByName,
  upsertCharacter,
  deleteCharacter,
} from './tools/characters.js';
import {
  listTimeline,
  getTimelineEntry,
  logTimelineEvent,
  updateTimelineEntry,
  deleteTimelineEntry,
} from './tools/timeline.js';
import {
  listTomes,
  getTome,
  findTomeByTitle,
  upsertTome,
  deleteTome,
} from './tools/tomes.js';
import {
  addRelationship,
  listRelationships,
  removeRelationship,
} from './tools/relationships.js';
import {
  listThreads,
  getThread,
  upsertThread,
  resolveThread,
  deleteThread,
} from './tools/threads.js';
import {
  listHouses,
  getHouse,
  findHouseByName,
  upsertHouse,
  deleteHouse,
} from './tools/houses.js';
import {
  searchChronicle,
  getRealmRecap,
} from './tools/search.js';
import {
  upsertSecret,
  updateSecretKnowledge,
  listSecrets,
  getCharacterKnowledge,
} from './tools/secrets.js';
import {
  getSceneBriefing,
} from './tools/director.js';
import {
  routeSkill,
  listSkills,
  getSkill,
} from './tools/skills.js';
import {
  loadAllSkills,
  getSkillById,
} from './skills/loader.js';
import {
  listCommands,
} from './tools/help.js';
import {
  CharacterSchema,
  TimelineEntrySchema,
  TimelineUpdateSchema,
  TomeSchema,
  RelationshipEdgeSchema,
  ThreadSchema,
  HouseSchema,
  SecretSchema,
  CampaignPulseUpdateSchema,
  SceneBriefingInputSchema,
  RouteSkillInputSchema,
  GetSkillInputSchema,
  ListSkillsInputSchema,
} from './schema.js';

export function createChronicleServer(storageInstance?: Storage): Server {
  const storage = storageInstance || new Storage();

  const server = new Server(
    {
      name: 'chronicle-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
    }
  );

  // MCP Prompts Handler (ListPromptsRequestSchema)
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    const skills = loadAllSkills();
    return {
      prompts: skills.map((s) => ({
        name: s.id,
        description: s.description,
        arguments: [
          {
            name: 'context',
            description: 'Optional scene details, intent, or participating character names',
            required: false,
          },
        ],
      })),
    };
  });

  // MCP Prompts Handler (GetPromptRequestSchema)
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const skillId = request.params.name;
    const skill = getSkillById(skillId);
    if (!skill) {
      throw new Error(`Prompt skill '${skillId}' not found.`);
    }
    const contextArg = request.params.arguments?.context || '';
    const userPrompt = [
      `# Active Roleplay Skill: ${skill.name} (${skill.id})`,
      `\n${skill.description}`,
      contextArg ? `\n## Scene Context & User Input:\n${contextArg}` : '',
      `\n## Recommended Tool Sequence:\n${skill.toolSequence.map((t) => `* \`${t}\``).join('\n')}`,
      `\n---\n${skill.playbook}`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      description: skill.description,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: userPrompt,
          },
        },
      ],
    };
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // RP Skill Router Tools
        {
          name: 'route_skill',
          description:
            'Dynamically routes intent to the optimal roleplay skill cartridge, scores triggers with live campaign state boosts, and returns directives plus prefetched context in a single round-trip.',
          inputSchema: {
            type: 'object',
            properties: {
              intent: {
                type: 'string',
                description:
                  'Freeform intent or prompt (e.g. "Hold a tense council meeting with Raymund and Saera", "@court-intrigue")',
              },
              characterIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Cast characters in the scene',
              },
              locationName: {
                type: 'string',
                description: 'Location of the scene (e.g. "The Maidenpool Salt Cellar")',
              },
              povCharacterId: {
                type: 'string',
                description: 'Focal POV character for anti-metagaming checks',
              },
              autoBrief: {
                type: 'boolean',
                description: 'Whether to auto-prefetch scene_briefing or realm_recap (default true)',
              },
              includeSecondary: {
                type: 'boolean',
                description: 'Whether to attach secondary skill directives if runner-up is close (default true)',
              },
              campaignId: {
                type: 'string',
                description: 'Optional campaign override',
              },
            },
            required: ['intent'],
          },
        },
        {
          name: 'list_skills',
          description:
            'List all registered roleplay skill playbooks with key triggers, auto-prefetch behavior, and campaign scopes.',
          inputSchema: {
            type: 'object',
            properties: {
              includeAllCampaigns: {
                type: 'boolean',
                description: 'Whether to include custom skills scoped to other campaigns (default false)',
              },
              campaignId: {
                type: 'string',
                description: 'Optional campaign scope',
              },
            },
          },
        },
        {
          name: 'get_skill',
          description:
            'Retrieve the full playbook, tool sequence, and directives for a specific roleplay skill by ID.',
          inputSchema: {
            type: 'object',
            properties: {
              skillId: {
                type: 'string',
                description: 'Skill handle (e.g. "court-intrigue", "war-and-reckoning")',
              },
            },
            required: ['skillId'],
          },
        },
        // Campaign Tools
        {
          name: 'list_campaigns',
          description:
            'List all campaign playthroughs stored in chronicle-mcp along with basic stats (character, event, thread, house counts) and active status.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'create_campaign',
          description:
            'Create a new campaign record without switching to it immediately.',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'The name of the new campaign (e.g. "Britannia")',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'set_active_campaign',
          description:
            'Switch the currently active campaign context for all subsequent tool calls.',
          inputSchema: {
            type: 'object',
            properties: {
              name_or_id: {
                type: 'string',
                description: 'The campaign name or ID to set as active',
              },
            },
            required: ['name_or_id'],
          },
        },
        {
          name: 'get_active_campaign',
          description:
            'Get details of the currently active campaign context.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'update_realm_pulse',
          description:
            'Update campaign setting, current date, sort year anchor, era, active player character, or realmMood (atmosphere, stability, crises, smallfolk whispers).',
          inputSchema: {
            type: 'object',
            properties: {
              campaignId: { type: 'string', description: 'Optional campaign ID (defaults to active)' },
              setting: { type: 'string', description: 'Setting description, e.g. "Westeros - AGoT"' },
              currentDate: { type: 'string', description: 'Display date, e.g. "289 AC, Late Autumn"' },
              currentSortYear: { type: 'number', description: 'Numeric year anchor for age & chronological math' },
              currentEra: { type: 'string', description: 'Current era, e.g. "The Long Regency"' },
              playerCharacterId: { type: 'string', description: 'Name or ID of active POV ruler/character' },
              realmMood: {
                type: 'object',
                properties: {
                  atmosphere: { type: 'string' },
                  stability: { type: 'string', enum: ['stable', 'uneasy', 'volatile', 'fracturing'] },
                  seasonOrWeather: { type: 'string' },
                  activeCrises: { type: 'array', items: { type: 'string' } },
                  smallfolkWhispers: { type: 'array', items: { type: 'string' } },
                },
              },
              addWhisper: { type: 'string', description: 'Convenience shortcut to append a single rumor' },
              retireWhisper: { type: 'string', description: 'Convenience shortcut to remove an outdated rumor' },
              addCrisis: { type: 'string', description: 'Convenience shortcut to add a crisis pressure' },
              resolveCrisis: { type: 'string', description: 'Convenience shortcut to resolve a crisis' },
            },
          },
        },

        // Character Tools
        {
          name: 'list_characters',
          description:
            'List summary cards for all characters in the active campaign, with optional filters for status (alive/dead/unknown), house, or tag.',
          inputSchema: {
            type: 'object',
            properties: {
              filter: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  house: { type: 'string' },
                  tag: { type: 'string' },
                },
              },
            },
          },
        },
        {
          name: 'get_character',
          description:
            'Retrieve a full character dossier in the active campaign by exact ID or case-insensitive exact name match.',
          inputSchema: {
            type: 'object',
            properties: {
              name_or_id: { type: 'string' },
            },
            required: ['name_or_id'],
          },
        },
        {
          name: 'find_character_by_name',
          description:
            'Find a character in the active campaign by exact name string. Returns basic matches with IDs for further updates.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
            required: ['name'],
          },
        },
        {
          name: 'upsert_character',
          description:
            'Create or update a character in the active campaign. Omit `id` to create a new character record.',
          inputSchema: {
            type: 'object',
            properties: {
              character: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  title: { type: 'string' },
                  house: { type: 'string' },
                  culture: { type: 'string' },
                  religion: { type: 'string' },
                  born: { type: 'string' },
                  died: { type: 'string' },
                  status: { type: 'string' },
                  summary: { type: 'string' },
                  notes: { type: 'array', items: { type: 'string' } },
                  tags: { type: 'array', items: { type: 'string' } },
                },
                required: ['name'],
              },
            },
            required: ['character'],
          },
        },
        {
          name: 'delete_character',
          description: 'Delete a character by ID from the active campaign.',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
            required: ['id'],
          },
        },

        // Timeline Tools
        {
          name: 'list_timeline',
          description:
            'List timeline events in the active campaign sorted descending by date/creation, with optional filters for tag or date search.',
          inputSchema: {
            type: 'object',
            properties: {
              filter: {
                type: 'object',
                properties: {
                  tag: { type: 'string' },
                  dateContains: { type: 'string' },
                },
              },
              limit: { type: 'number' },
            },
          },
        },
        {
          name: 'get_timeline_entry',
          description: 'Retrieve a single timeline entry by ID from the active campaign.',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
            required: ['id'],
          },
        },
        {
          name: 'log_timeline_event',
          description:
            'Log a new event to the active campaign timeline and auto-sync notes to tagged characters in the active campaign.',
          inputSchema: {
            type: 'object',
            properties: {
              entry: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  title: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' } },
                  narrative: { type: 'string' },
                  mechanicalOutcome: { type: 'string' },
                  involvedCharacters: { type: 'array', items: { type: 'string' } },
                },
                required: ['title', 'narrative'],
              },
            },
            required: ['entry'],
          },
        },
        {
          name: 'update_timeline_entry',
          description: 'Update an existing timeline entry in the active campaign by ID.',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              patch: { type: 'object' },
            },
            required: ['id', 'patch'],
          },
        },
        {
          name: 'delete_timeline_entry',
          description: 'Delete a timeline entry by ID from the active campaign.',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
            required: ['id'],
          },
        },

        // Tome Tools
        {
          name: 'list_tomes',
          description:
            'List lore tomes in the active campaign with optional category or tag filter.',
          inputSchema: {
            type: 'object',
            properties: {
              filter: {
                type: 'object',
                properties: {
                  category: { type: 'string' },
                  tag: { type: 'string' },
                },
              },
            },
          },
        },
        {
          name: 'get_tome',
          description: 'Retrieve a tome by ID or exact title from the active campaign.',
          inputSchema: {
            type: 'object',
            properties: {
              title_or_id: { type: 'string' },
            },
            required: ['title_or_id'],
          },
        },
        {
          name: 'find_tome_by_title',
          description: 'Find a tome in the active campaign by exact title.',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
            },
            required: ['title'],
          },
        },
        {
          name: 'upsert_tome',
          description:
            'Create or update a lore tome in the active campaign. Omit `id` to create a new tome.',
          inputSchema: {
            type: 'object',
            properties: {
              tome: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  category: { type: 'string' },
                  content: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' } },
                },
                required: ['title', 'content'],
              },
            },
            required: ['tome'],
          },
        },
        {
          name: 'delete_tome',
          description: 'Delete a tome by ID from the active campaign.',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
            required: ['id'],
          },
        },

        // Relationship Tools
        {
          name: 'add_relationship',
          description:
            'Create or update a directional or reciprocal relationship edge pair in the active campaign.',
          inputSchema: {
            type: 'object',
            properties: {
              fromType: { type: 'string' },
              fromId: { type: 'string' },
              toType: { type: 'string' },
              toId: { type: 'string' },
              type: { type: 'string' },
              note: { type: 'string' },
            },
            required: ['fromType', 'fromId', 'toType', 'toId', 'type'],
          },
        },
        {
          name: 'list_relationships',
          description:
            'List all relationship edges connected to a specific entity in the active campaign.',
          inputSchema: {
            type: 'object',
            properties: {
              entityType: { type: 'string' },
              entityId: { type: 'string' },
            },
            required: ['entityType', 'entityId'],
          },
        },
        {
          name: 'remove_relationship',
          description: 'Delete a relationship edge pair by ID from the active campaign.',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
            required: ['id'],
          },
        },

        // Plot Thread Tools
        {
          name: 'list_threads',
          description: 'List plot threads in the active campaign.',
          inputSchema: {
            type: 'object',
            properties: {
              filter: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  tag: { type: 'string' },
                },
              },
            },
          },
        },
        {
          name: 'get_thread',
          description: 'Get details of a single plot thread in the active campaign by ID.',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
            required: ['id'],
          },
        },
        {
          name: 'upsert_thread',
          description: 'Create or update a plot thread in the active campaign.',
          inputSchema: {
            type: 'object',
            properties: {
              thread: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  summary: { type: 'string' },
                  status: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' } },
                },
                required: ['title', 'summary'],
              },
            },
            required: ['thread'],
          },
        },
        {
          name: 'resolve_thread',
          description: 'Resolve a plot thread in the active campaign.',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              resolutionNote: { type: 'string' },
            },
            required: ['id', 'resolutionNote'],
          },
        },
        {
          name: 'delete_thread',
          description: 'Delete a plot thread by ID from the active campaign.',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
            required: ['id'],
          },
        },

        // House Tools
        {
          name: 'list_houses',
          description: 'List noble houses in the active campaign.',
          inputSchema: {
            type: 'object',
            properties: {
              filter: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  tag: { type: 'string' },
                },
              },
            },
          },
        },
        {
          name: 'get_house',
          description: 'Retrieve house details by ID or name from the active campaign.',
          inputSchema: {
            type: 'object',
            properties: {
              name_or_id: { type: 'string' },
            },
            required: ['name_or_id'],
          },
        },
        {
          name: 'find_house_by_name',
          description: 'Find a house in the active campaign by exact name.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
            required: ['name'],
          },
        },
        {
          name: 'upsert_house',
          description: 'Create or update a noble house in the active campaign.',
          inputSchema: {
            type: 'object',
            properties: {
              house: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  motto: { type: 'string' },
                  coatOfArms: { type: 'string' },
                  summary: { type: 'string' },
                  notes: { type: 'array', items: { type: 'string' } },
                  tags: { type: 'array', items: { type: 'string' } },
                },
                required: ['name'],
              },
            },
            required: ['house'],
          },
        },
        {
          name: 'delete_house',
          description: 'Delete a house by ID from the active campaign.',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
            required: ['id'],
          },
        },

        // Secret & Intrigue Tools
        {
          name: 'upsert_secret',
          description:
            'Create or update a secret, hidden conspiracy, or leverage point in the active campaign.',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Optional secret ID for updates' },
              title: { type: 'string', description: 'Short handle, e.g. "Perwyn\'s True Killer"' },
              truth: { type: 'string', description: 'Objective ground truth' },
              publicCoverStory: { type: 'string', description: 'Official narrative believed by the realm' },
              severity: { type: 'string', enum: ['gossip', 'scandal', 'treason', 'dynasty_ending'] },
              status: { type: 'string', enum: ['buried', 'whispered', 'exposed', 'discredited'] },
              subjectIds: { type: 'array', items: { type: 'string' }, description: 'Characters or Houses implicated/affected' },
              knownByCharacterIds: { type: 'array', items: { type: 'string' }, description: 'Characters with proof or direct knowledge' },
              suspectedByCharacterIds: { type: 'array', items: { type: 'string' }, description: 'Characters who have partial clues or suspicions' },
              leverageNote: { type: 'string', description: 'Concrete fallout or leverage if exposed' },
              relatedEventIds: { type: 'array', items: { type: 'string' } },
              tags: { type: 'array', items: { type: 'string' } },
              note: { type: 'string', description: 'Optional historyLog entry note' },
              date: { type: 'string' },
              campaignId: { type: 'string' },
            },
            required: ['title', 'truth'],
          },
        },
        {
          name: 'update_secret_knowledge',
          description:
            'Atomic intrigue transition: Character learns, suspects, forgets, or exposes a secret.',
          inputSchema: {
            type: 'object',
            properties: {
              secretId: { type: 'string', description: 'Secret ID or exact title' },
              characterId: { type: 'string', description: 'Character name or ID' },
              action: { type: 'string', enum: ['learns', 'suspects', 'forgets', 'exposes'] },
              date: { type: 'string' },
              note: { type: 'string' },
              autoLogTimelineEvent: { type: 'boolean', description: 'When exposing, automatically log a public timeline event' },
              campaignId: { type: 'string' },
            },
            required: ['secretId', 'characterId', 'action'],
          },
        },
        {
          name: 'list_secrets',
          description:
            'Query secrets with filters (status, severity, subject, knower) with names resolved for clean LLM readability.',
          inputSchema: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['buried', 'whispered', 'exposed', 'discredited'] },
              severity: { type: 'string', enum: ['gossip', 'scandal', 'treason', 'dynasty_ending'] },
              subjectId: { type: 'string', description: 'Filter by character/house implicated' },
              knownByCharacterId: { type: 'string', description: 'Filter by character with direct knowledge' },
              unexposedOnly: { type: 'boolean', description: 'Filter to secrets not yet publicly exposed' },
              campaignId: { type: 'string' },
            },
          },
        },
        {
          name: 'get_character_knowledge',
          description:
            'Anti-metagaming lens: retrieve what a character knows, suspects, and blind spots without leaking unexposed truths.',
          inputSchema: {
            type: 'object',
            properties: {
              characterId: { type: 'string', description: 'Character name or ID' },
              campaignId: { type: 'string' },
            },
            required: ['characterId'],
          },
        },

        // Director & Staging Tools
        {
          name: 'get_scene_briefing',
          description:
            'Director Engine: generate a dense, curated scene briefing before roleplay scenes. Computes cast cards, in-room relationships, grudges, atmosphere, and the Intrigue Matrix (active leverage, shared conspiracies, and anti-metagaming GM guardrails).',
          inputSchema: {
            type: 'object',
            properties: {
              characterIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Names or IDs of characters present in the scene',
              },
              locationName: { type: 'string', description: 'Holding or location name' },
              povCharacterId: { type: 'string', description: 'POV character name or ID (defaults to active player character)' },
              includeOmniscientSecrets: { type: 'boolean', description: 'Include secrets unknown to room cast for GM perspective (default true)' },
              campaignId: { type: 'string' },
            },
            required: ['characterIds'],
          },
        },

        // Search & Recap Tools
        {
          name: 'search_chronicle',
          description:
            'Perform a global search across active campaign records (characters, timeline, tomes, threads, houses, secrets).',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              sections: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['characters', 'timeline', 'tomes', 'threads', 'houses', 'secrets'],
                },
              },
              includeSecrets: {
                type: 'boolean',
                description: 'Whether to include hidden secrets (default true; set false for in-world public archive search)',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_realm_recap',
          description:
            'Generate a summary recap of the active campaign realm state.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'list_commands',
          description:
            'List all available Chronicle MCP tools/commands grouped by category, with explanations, parameter descriptions, and example usages.',
          inputSchema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                description:
                  'Optional category filter (e.g. "Campaigns", "Characters", "Timeline", "Relationships", "Plot Threads", "Houses", "Lore Tomes", "Search & Recap", or "all").',
              },
            },
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        // Campaign Tools
        case 'list_campaigns': {
          const res = listCampaigns(storage);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'create_campaign': {
          const { name: campaignName } = args as { name: string };
          const res = createCampaign(storage, campaignName);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'set_active_campaign': {
          const { name_or_id } = args as { name_or_id: string };
          const res = setActiveCampaign(storage, name_or_id);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'get_active_campaign': {
          const res = getActiveCampaign(storage);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'update_realm_pulse': {
          const parsed = CampaignPulseUpdateSchema.parse(args);
          const res = updateRealmPulse(storage, parsed);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }

        // Character Tools
        case 'list_characters': {
          const res = listCharacters(storage, (args as any)?.filter);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'get_character': {
          const { name_or_id } = args as { name_or_id: string };
          const res = getCharacter(storage, name_or_id);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'find_character_by_name': {
          const { name: queryName } = args as { name: string };
          const res = findCharacterByName(storage, queryName);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'upsert_character': {
          const rawChar = (args as any)?.character || args;
          const parsed = CharacterSchema.parse(rawChar);
          const res = upsertCharacter(storage, parsed);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'delete_character': {
          const { id } = args as { id: string };
          const res = deleteCharacter(storage, id);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }

        // Timeline Tools
        case 'list_timeline': {
          const res = listTimeline(storage, (args as any)?.filter, (args as any)?.limit);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'get_timeline_entry': {
          const { id } = args as { id: string };
          const res = getTimelineEntry(storage, id);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'log_timeline_event': {
          const rawEntry = (args as any)?.entry || args;
          const parsed = TimelineEntrySchema.parse(rawEntry);
          const res = logTimelineEvent(storage, parsed);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'update_timeline_entry': {
          const { id, patch } = args as { id: string; patch: any };
          const parsedPatch = TimelineUpdateSchema.parse(patch);
          const res = updateTimelineEntry(storage, id, parsedPatch);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'delete_timeline_entry': {
          const { id } = args as { id: string };
          const res = deleteTimelineEntry(storage, id);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }

        // Tome Tools
        case 'list_tomes': {
          const res = listTomes(storage, (args as any)?.filter || args);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'get_tome': {
          const { title_or_id } = args as { title_or_id: string };
          const res = getTome(storage, title_or_id);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'find_tome_by_title': {
          const { title: queryTitle } = args as { title: string };
          const res = findTomeByTitle(storage, queryTitle);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'upsert_tome': {
          const rawTome = (args as any)?.tome || args;
          const parsed = TomeSchema.parse(rawTome);
          const res = upsertTome(storage, parsed);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'delete_tome': {
          const { id } = args as { id: string };
          const res = deleteTome(storage, id);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }

        // Relationship Tools
        case 'add_relationship': {
          const parsed = RelationshipEdgeSchema.parse(args);
          const res = addRelationship(storage, parsed);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'list_relationships': {
          const { entityType, entityId, includeSecrets } = args as {
            entityType: 'character' | 'house';
            entityId: string;
            includeSecrets?: boolean;
          };
          const res = listRelationships(storage, entityType, entityId, includeSecrets !== false);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'remove_relationship': {
          const { id } = args as { id: string };
          const res = removeRelationship(storage, id);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }

        // Thread Tools
        case 'list_threads': {
          const res = listThreads(storage, (args as any)?.filter);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'get_thread': {
          const { id } = args as { id: string };
          const res = getThread(storage, id);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'upsert_thread': {
          const rawThread = (args as any)?.thread || args;
          const parsed = ThreadSchema.parse(rawThread);
          const res = upsertThread(storage, parsed);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'resolve_thread': {
          const { id, resolutionNote } = args as { id: string; resolutionNote: string };
          const res = resolveThread(storage, id, resolutionNote);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'delete_thread': {
          const { id } = args as { id: string };
          const res = deleteThread(storage, id);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }

        // House Tools
        case 'list_houses': {
          const res = listHouses(storage, (args as any)?.filter);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'get_house': {
          const { name_or_id } = args as { name_or_id: string };
          const res = getHouse(storage, name_or_id);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'find_house_by_name': {
          const { name: queryName } = args as { name: string };
          const res = findHouseByName(storage, queryName);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'upsert_house': {
          const rawHouse = (args as any)?.house || args;
          const parsed = HouseSchema.parse(rawHouse);
          const res = upsertHouse(storage, parsed);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'delete_house': {
          const { id } = args as { id: string };
          const res = deleteHouse(storage, id);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }

        // Secret & Intrigue Tools
        case 'upsert_secret': {
          const rawSecret = (args as any)?.secret || args;
          const parsed = SecretSchema.parse(rawSecret);
          const res = upsertSecret(storage, parsed);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'update_secret_knowledge': {
          const res = updateSecretKnowledge(storage, args as any);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'list_secrets': {
          const res = listSecrets(storage, args as any);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'get_character_knowledge': {
          const { characterId, campaignId } = args as { characterId: string; campaignId?: string };
          const res = getCharacterKnowledge(storage, { characterId, campaignId });
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }

        // RP Skill Router Tools
        case 'route_skill': {
          const parsed = RouteSkillInputSchema.parse(args);
          const res = routeSkill(storage, parsed);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'list_skills': {
          const parsed = ListSkillsInputSchema.parse(args || {});
          const res = listSkills(storage, parsed);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'get_skill': {
          const parsed = GetSkillInputSchema.parse(args);
          const res = getSkill(storage, parsed);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }

        // Director & Staging Tools
        case 'get_scene_briefing': {
          const parsed = SceneBriefingInputSchema.parse(args);
          const res = getSceneBriefing(storage, parsed);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }

        // Search & Recap Tools
        case 'search_chronicle': {
          const { query, sections, includeSecrets } = args as {
            query: string;
            sections?: ('characters' | 'timeline' | 'tomes' | 'threads' | 'houses' | 'secrets')[];
            includeSecrets?: boolean;
          };
          const res = searchChronicle(storage, query, sections, includeSecrets !== false);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'get_realm_recap': {
          const res = getRealmRecap(storage);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'list_commands':
        case 'get_help':
        case 'help': {
          const { category } = (args || {}) as { category?: string };
          const res = listCommands(category);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (err: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: false, error: err.message || String(err) }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

async function main() {
  const server = createChronicleServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[chronicle-mcp] Server running on stdio');
}

// Run stdio server if executed directly
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  main().catch((err) => {
    console.error('[chronicle-mcp] Fatal error in main():', err);
    process.exit(1);
  });
}
