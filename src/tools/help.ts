export interface CommandHelp {
  name: string;
  category: string;
  summary: string;
  description: string;
  usageExample?: string;
}

export const CHRONICLE_COMMANDS: CommandHelp[] = [
  // Campaign Tools
  {
    name: 'list_campaigns',
    category: 'Campaigns',
    summary: 'List all campaigns with summary counts and active status.',
    description: 'Lists all CK2/CK3 playthroughs stored in chronicle-mcp, including total characters, timeline events, open plot threads, houses, and which campaign is currently active.',
    usageExample: 'chronicle/list_campaigns {}',
  },
  {
    name: 'get_active_campaign',
    category: 'Campaigns',
    summary: 'Get details of the currently active campaign context.',
    description: 'Returns the name, ID, and creation timestamp of the currently active campaign.',
    usageExample: 'chronicle/get_active_campaign {}',
  },
  {
    name: 'set_active_campaign',
    category: 'Campaigns',
    summary: 'Switch active campaign context for all subsequent operations.',
    description: 'Switches the active campaign by name or ID. All subsequent character, timeline, house, and thread calls will be scoped to this campaign.',
    usageExample: 'chronicle/set_active_campaign { name_or_id: "campaign-game-of-thrones-msbd" }',
  },
  {
    name: 'create_campaign',
    category: 'Campaigns',
    summary: 'Create a new campaign record without activating it immediately.',
    description: 'Creates a new campaign with a unique slug ID.',
    usageExample: 'chronicle/create_campaign { name: "Britannia" }',
  },

  // Character Tools
  {
    name: 'list_characters',
    category: 'Characters',
    summary: 'List summary cards for characters in the active campaign.',
    description: 'Lists all characters in the active campaign, with optional filters for status ("alive" | "dead" | "unknown"), house, or tag.',
    usageExample: 'chronicle/list_characters { filter: { status: "alive" } }',
  },
  {
    name: 'get_character',
    category: 'Characters',
    summary: 'Retrieve full dossier for a character by exact ID or name.',
    description: 'Returns complete character details: titles, traits, stats, notes, family connections, and life status.',
    usageExample: 'chronicle/get_character { name_or_id: "jon-mooton" }',
  },
  {
    name: 'find_character_by_name',
    category: 'Characters',
    summary: 'Find a character by exact name string.',
    description: 'Searches for a character in the active campaign by exact name and returns basic match info with IDs.',
    usageExample: 'chronicle/find_character_by_name { name: "Jon Mooton" }',
  },
  {
    name: 'upsert_character',
    category: 'Characters',
    summary: 'Create or update a character dossier.',
    description: 'Inserts a new character or updates an existing one in the active campaign. Omit "id" to create a new record.',
    usageExample: 'chronicle/upsert_character { character: { name: "Raymund Mooton", house: "House Mooton", status: "alive" } }',
  },
  {
    name: 'delete_character',
    category: 'Characters',
    summary: 'Delete a character record by ID.',
    description: 'Permanently removes a character dossier and associated relationship edges from the active campaign.',
    usageExample: 'chronicle/delete_character { id: "char-123" }',
  },

  // Timeline Tools
  {
    name: 'list_timeline',
    category: 'Timeline',
    summary: 'List timeline events sorted descending with optional filters.',
    description: 'Lists chronological timeline events in the active campaign with optional filtering by tag or date string, and optional limit.',
    usageExample: 'chronicle/list_timeline { limit: 10 }',
  },
  {
    name: 'get_timeline_entry',
    category: 'Timeline',
    summary: 'Retrieve a single timeline entry by ID.',
    description: 'Returns the full narrative, mechanical outcome, date, and tagged characters for a timeline event.',
    usageExample: 'chronicle/get_timeline_entry { id: "event-123" }',
  },
  {
    name: 'log_timeline_event',
    category: 'Timeline',
    summary: 'Log a new narrative & mechanical event to the timeline.',
    description: 'Logs a historical event to the timeline and automatically synchronizes event notes into tagged characters in the active campaign.',
    usageExample: 'chronicle/log_timeline_event { entry: { title: "Battle of Maidenpool", date: "8023", narrative: "...", mechanicalOutcome: "..." } }',
  },
  {
    name: 'update_timeline_entry',
    category: 'Timeline',
    summary: 'Update an existing timeline event.',
    description: 'Patches fields (date, title, narrative, mechanicalOutcome, tags) on an existing timeline entry.',
    usageExample: 'chronicle/update_timeline_entry { id: "event-123", patch: { title: "Updated Title" } }',
  },
  {
    name: 'delete_timeline_entry',
    category: 'Timeline',
    summary: 'Delete a timeline entry by ID.',
    description: 'Deletes a timeline event from the active campaign.',
    usageExample: 'chronicle/delete_timeline_entry { id: "event-123" }',
  },

  // Relationship Tools
  {
    name: 'add_relationship',
    category: 'Relationships',
    summary: 'Add a directional or reciprocal relationship edge pair.',
    description: 'Creates connection between two entities (character-to-character or character-to-house), e.g. spouse, parent, child, rival, ally, vassal.',
    usageExample: 'chronicle/add_relationship { fromType: "character", fromId: "jon-mooton", toType: "character", toId: "denyse-hightower", type: "spouse" }',
  },
  {
    name: 'list_relationships',
    category: 'Relationships',
    summary: 'List all relationship edges for a specific character or house.',
    description: 'Retrieves all incoming and outgoing connections for an entity in the active campaign.',
    usageExample: 'chronicle/list_relationships { entityType: "character", entityId: "jon-mooton" }',
  },
  {
    name: 'remove_relationship',
    category: 'Relationships',
    summary: 'Remove a relationship edge pair by ID.',
    description: 'Deletes a specific relationship link.',
    usageExample: 'chronicle/remove_relationship { id: "rel-123" }',
  },

  // Plot Thread Tools
  {
    name: 'list_threads',
    category: 'Plot Threads',
    summary: 'List open and resolved plot threads.',
    description: 'Lists narrative goals, mysteries, feuds, and succession crises in the active campaign.',
    usageExample: 'chronicle/list_threads { filter: { status: "open" } }',
  },
  {
    name: 'get_thread',
    category: 'Plot Threads',
    summary: 'Get details of a single plot thread by ID.',
    description: 'Retrieves full summary, resolution notes, and status for a plot thread.',
    usageExample: 'chronicle/get_thread { id: "thread-123" }',
  },
  {
    name: 'upsert_thread',
    category: 'Plot Threads',
    summary: 'Create or update a plot thread.',
    description: 'Inserts or updates an ongoing plot thread in the active campaign.',
    usageExample: 'chronicle/upsert_thread { thread: { title: "Who Killed Perwyn", summary: "...", status: "open" } }',
  },
  {
    name: 'resolve_thread',
    category: 'Plot Threads',
    summary: 'Mark a plot thread as resolved with a conclusion note.',
    description: 'Changes thread status to "resolved" and attaches a final resolution summary.',
    usageExample: 'chronicle/resolve_thread { id: "thread-123", resolutionNote: "The assassin was uncovered as..." }',
  },
  {
    name: 'delete_thread',
    category: 'Plot Threads',
    summary: 'Delete a plot thread by ID.',
    description: 'Permanently deletes a thread from the active campaign.',
    usageExample: 'chronicle/delete_thread { id: "thread-123" }',
  },

  // Noble House Tools
  {
    name: 'list_houses',
    category: 'Houses',
    summary: 'List noble dynasties and houses.',
    description: 'Lists all noble houses in the active campaign with motto, holdings, coat of arms, and status.',
    usageExample: 'chronicle/list_houses {}',
  },
  {
    name: 'get_house',
    category: 'Houses',
    summary: 'Retrieve noble house details by ID or exact name.',
    description: 'Returns complete house profile, motto, holdings, and notes.',
    usageExample: 'chronicle/get_house { name_or_id: "House Mooton" }',
  },
  {
    name: 'find_house_by_name',
    category: 'Houses',
    summary: 'Find a house in the active campaign by exact name.',
    description: 'Searches for a house by name.',
    usageExample: 'chronicle/find_house_by_name { name: "House Mooton" }',
  },
  {
    name: 'upsert_house',
    category: 'Houses',
    summary: 'Create or update a noble house.',
    description: 'Inserts or updates a noble house record in the active campaign.',
    usageExample: 'chronicle/upsert_house { house: { name: "House Mooton", motto: "Wisdom and Strength" } }',
  },
  {
    name: 'delete_house',
    category: 'Houses',
    summary: 'Delete a noble house by ID.',
    description: 'Deletes a house record from the active campaign.',
    usageExample: 'chronicle/delete_house { id: "house-123" }',
  },

  // Lore Tome Tools
  {
    name: 'list_tomes',
    category: 'Lore Tomes',
    summary: 'List custom lore tomes and rules in the active campaign.',
    description: 'Lists custom lore articles, succession laws, and background tomes.',
    usageExample: 'chronicle/list_tomes {}',
  },
  {
    name: 'get_tome',
    category: 'Lore Tomes',
    summary: 'Retrieve lore tome by title or ID.',
    description: 'Returns full content of a lore tome.',
    usageExample: 'chronicle/get_tome { title_or_id: "tome-123" }',
  },
  {
    name: 'upsert_tome',
    category: 'Lore Tomes',
    summary: 'Create or update a lore tome.',
    description: 'Inserts or updates a lore tome with markdown content in the active campaign.',
    usageExample: 'chronicle/upsert_tome { tome: { title: "House Laws", category: "Laws", content: "..." } }',
  },
  {
    name: 'delete_tome',
    category: 'Lore Tomes',
    summary: 'Delete a lore tome by ID.',
    description: 'Deletes a lore tome from the active campaign.',
    usageExample: 'chronicle/delete_tome { id: "tome-123" }',
  },

  // Search & Help Tools
  {
    name: 'search_chronicle',
    category: 'Search & Recap',
    summary: 'Search across all entities in the active campaign.',
    description: 'Performs global keyword search across characters, timeline entries, tomes, houses, and plot threads.',
    usageExample: 'chronicle/search_chronicle { query: "Maidenpool" }',
  },
  {
    name: 'get_realm_recap',
    category: 'Search & Recap',
    summary: 'Generate an executive realm recap.',
    description: 'Returns a comprehensive summary of the active campaign: player characters, living nobles, key recent timeline events, and open plot threads.',
    usageExample: 'chronicle/get_realm_recap {}',
  },
  {
    name: 'list_commands',
    category: 'Search & Recap',
    summary: 'List all Chronicle MCP commands with explanations and usage examples.',
    description: 'Returns a complete catalog of all available Chronicle tools, grouped by category, with summaries, detailed descriptions, and example inputs.',
    usageExample: 'chronicle/list_commands { category: "all" }',
  },
];

export function listCommands(category?: string) {
  let filtered = CHRONICLE_COMMANDS;
  if (category && category.toLowerCase() !== 'all') {
    const catLower = category.toLowerCase();
    filtered = CHRONICLE_COMMANDS.filter(
      (c) => c.category.toLowerCase().includes(catLower) || c.name.toLowerCase().includes(catLower)
    );
  }

  const categories = Array.from(new Set(CHRONICLE_COMMANDS.map((c) => c.category)));

  return {
    success: true,
    totalCommands: filtered.length,
    categories,
    commands: filtered,
  };
}
