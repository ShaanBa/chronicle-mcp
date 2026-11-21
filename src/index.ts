import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { Storage } from './storage.js';
import {
  listCampaigns,
  createCampaign,
  setActiveCampaign,
  getActiveCampaign,
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
} from './schema.js';

export function createChronicleServer(): Server {
  const storage = new Storage();

  const server = new Server(
    {
      name: 'chronicle-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
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

        // Search & Recap Tools
        {
          name: 'search_chronicle',
          description:
            'Perform a global search across active campaign records.',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              sections: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['characters', 'timeline', 'tomes', 'threads', 'houses'],
                },
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
          const parsed = CharacterSchema.parse((args as any)?.character);
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
          const parsed = TimelineEntrySchema.parse((args as any)?.entry);
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
          const res = listTomes(storage, (args as any)?.filter);
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
          const parsed = TomeSchema.parse((args as any)?.tome);
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
          const { entityType, entityId } = args as { entityType: 'character' | 'house'; entityId: string };
          const res = listRelationships(storage, entityType, entityId);
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
          const parsed = ThreadSchema.parse((args as any)?.thread);
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
          const parsed = HouseSchema.parse((args as any)?.house);
          const res = upsertHouse(storage, parsed);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }
        case 'delete_house': {
          const { id } = args as { id: string };
          const res = deleteHouse(storage, id);
          return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
        }

        // Search & Recap Tools
        case 'search_chronicle': {
          const { query, sections } = args as {
            query: string;
            sections?: ('characters' | 'timeline' | 'tomes' | 'threads' | 'houses')[];
          };
          const res = searchChronicle(storage, query, sections);
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
