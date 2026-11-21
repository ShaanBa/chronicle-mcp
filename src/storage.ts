import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Character, TimelineEntry, Tome, RelationshipEdge, Thread, House, Campaign } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

export type StorageCollection =
  | 'characters'
  | 'timeline'
  | 'tomes'
  | 'relationships'
  | 'threads'
  | 'houses'
  | 'campaigns'
  | 'activeCampaign';

export class Storage {
  private dataDir: string;
  private charactersFile: string;
  private timelineFile: string;
  private tomesFile: string;
  private relationshipsFile: string;
  private threadsFile: string;
  private housesFile: string;
  private campaignsFile: string;
  private activeCampaignFile: string;

  public characters: Character[] = [];
  public timeline: TimelineEntry[] = [];
  public tomes: Tome[] = [];
  public relationships: RelationshipEdge[] = [];
  public threads: Thread[] = [];
  public houses: House[] = [];
  public campaigns: Campaign[] = [];
  public activeCampaignId: string = 'campaign-semien';

  private writeTimers: Record<StorageCollection, NodeJS.Timeout | null> = {
    characters: null,
    timeline: null,
    tomes: null,
    relationships: null,
    threads: null,
    houses: null,
    campaigns: null,
    activeCampaign: null,
  };

  private pendingWrites: Set<StorageCollection> = new Set();

  constructor(customDataDir?: string) {
    const defaultDir = path.resolve(__dirname, '..', 'data');
    this.dataDir = customDataDir || process.env.CHRONICLE_DATA_DIR || defaultDir;

    this.charactersFile = path.join(this.dataDir, 'characters.json');
    this.timelineFile = path.join(this.dataDir, 'timeline.json');
    this.tomesFile = path.join(this.dataDir, 'tomes.json');
    this.relationshipsFile = path.join(this.dataDir, 'relationships.json');
    this.threadsFile = path.join(this.dataDir, 'threads.json');
    this.housesFile = path.join(this.dataDir, 'houses.json');
    this.campaignsFile = path.join(this.dataDir, 'campaigns.json');
    this.activeCampaignFile = path.join(this.dataDir, 'active-campaign.json');

    this.init();
    this.setupExitHooks();
  }

  public getDataDir(): string {
    return this.dataDir;
  }

  private init() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    } catch (err) {
      console.error(`[chronicle-mcp] Failed to create data directory ${this.dataDir}:`, err);
    }

    this.campaigns = this.loadFile<Campaign>(this.campaignsFile, 'campaigns.json');
    if (this.campaigns.length === 0) {
      const defaultCampaign: Campaign = {
        id: 'campaign-semien',
        name: 'Semien',
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      };
      this.campaigns.push(defaultCampaign);
      this.scheduleWrite('campaigns');
    }

    // Load active campaign state
    if (fs.existsSync(this.activeCampaignFile)) {
      try {
        const raw = fs.readFileSync(this.activeCampaignFile, 'utf-8');
        const activeObj = JSON.parse(raw);
        if (activeObj && activeObj.activeCampaignId) {
          const matched = this.campaigns.find((c) => c.id === activeObj.activeCampaignId);
          if (matched) {
            this.activeCampaignId = matched.id;
          } else {
            this.activeCampaignId = this.campaigns[0].id;
          }
        }
      } catch (e) {
        this.activeCampaignId = this.campaigns[0].id;
      }
    } else {
      this.activeCampaignId = this.campaigns[0].id;
      this.scheduleWrite('activeCampaign');
    }

    this.characters = this.loadFile<Character>(this.charactersFile, 'characters.json');
    this.timeline = this.loadFile<TimelineEntry>(this.timelineFile, 'timeline.json');
    this.tomes = this.loadFile<Tome>(this.tomesFile, 'tomes.json');
    this.relationships = this.loadFile<RelationshipEdge>(this.relationshipsFile, 'relationships.json');
    this.threads = this.loadFile<Thread>(this.threadsFile, 'threads.json');
    this.houses = this.loadFile<House>(this.housesFile, 'houses.json');
  }

  private loadFile<T>(filePath: string, filename: string): T[] {
    try {
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf-8');
        return [];
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      if (!content.trim()) {
        return [];
      }

      const data = JSON.parse(content);
      if (!Array.isArray(data)) {
        throw new Error('Data in file is not an array');
      }
      return data as T[];
    } catch (err) {
      console.error(`[chronicle-mcp] WARNING: Corrupt or unparseable JSON file encountered at ${filePath}.`, err);
      try {
        const backupPath = `${filePath}.corrupt.${Date.now()}`;
        if (fs.existsSync(filePath)) {
          fs.renameSync(filePath, backupPath);
          console.error(`[chronicle-mcp] Renamed corrupted file to ${backupPath}`);
        }
        fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf-8');
      } catch (backupErr) {
        console.error(`[chronicle-mcp] Failed to backup corrupt file ${filePath}:`, backupErr);
      }
      return [];
    }
  }

  public getActiveCampaign(): Campaign {
    let campaign = this.campaigns.find((c) => c.id === this.activeCampaignId);
    if (!campaign) {
      campaign = this.campaigns[0] || {
        id: 'campaign-semien',
        name: 'Semien',
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      };
      this.activeCampaignId = campaign.id;
    }
    return campaign;
  }

  public createCampaign(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, message: 'Campaign name cannot be empty.' };
    }

    const existing = this.campaigns.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      return { success: false, message: `Campaign '${trimmed}' already exists (${existing.id}).` };
    }

    const newId = `campaign-${trimmed.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${generateId().substring(0, 4)}`;
    const newCampaign: Campaign = {
      id: newId,
      name: trimmed,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };

    this.campaigns.push(newCampaign);
    this.scheduleWrite('campaigns');

    return {
      success: true,
      message: `Created campaign '${trimmed}' (${newId}). Active campaign remains '${this.getActiveCampaign().name}'.`,
      campaign: newCampaign,
    };
  }

  public setActiveCampaign(nameOrId: string) {
    const query = nameOrId.trim();
    const queryLower = query.toLowerCase();

    const matched = this.campaigns.find(
      (c) => c.id === query || c.name.toLowerCase() === queryLower
    );

    if (!matched) {
      return {
        success: false,
        message: `Campaign '${nameOrId}' not found. Use list_campaigns to view all available campaigns.`,
      };
    }

    this.activeCampaignId = matched.id;
    matched.lastActiveAt = Date.now();

    this.scheduleWrite('campaigns');
    this.scheduleWrite('activeCampaign');

    return {
      success: true,
      message: `Switched active campaign to '${matched.name}' (${matched.id}).`,
      campaign: matched,
    };
  }

  public scheduleWrite(type: StorageCollection) {
    this.pendingWrites.add(type);
    if (this.writeTimers[type]) {
      clearTimeout(this.writeTimers[type]!);
    }

    this.writeTimers[type] = setTimeout(() => {
      this.flushWrite(type);
    }, 300);
  }

  public flushWrite(type: StorageCollection) {
    if (this.writeTimers[type]) {
      clearTimeout(this.writeTimers[type]!);
      this.writeTimers[type] = null;
    }

    if (!this.pendingWrites.has(type)) return;

    let targetPath: string;
    let data: any;

    switch (type) {
      case 'characters':
        targetPath = this.charactersFile;
        data = this.characters;
        break;
      case 'timeline':
        targetPath = this.timelineFile;
        data = this.timeline;
        break;
      case 'tomes':
        targetPath = this.tomesFile;
        data = this.tomes;
        break;
      case 'relationships':
        targetPath = this.relationshipsFile;
        data = this.relationships;
        break;
      case 'threads':
        targetPath = this.threadsFile;
        data = this.threads;
        break;
      case 'houses':
        targetPath = this.housesFile;
        data = this.houses;
        break;
      case 'campaigns':
        targetPath = this.campaignsFile;
        data = this.campaigns;
        break;
      case 'activeCampaign':
        targetPath = this.activeCampaignFile;
        data = { activeCampaignId: this.activeCampaignId };
        break;
    }

    try {
      const tempPath = `${targetPath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, targetPath);
      this.pendingWrites.delete(type);
    } catch (err) {
      console.error(`[chronicle-mcp] Error writing ${type} to disk:`, err);
    }
  }

  public flushAll() {
    for (const type of [
      'characters',
      'timeline',
      'tomes',
      'relationships',
      'threads',
      'houses',
      'campaigns',
      'activeCampaign',
    ] as const) {
      this.flushWrite(type);
    }
  }

  private setupExitHooks() {
    const onExit = () => {
      this.flushAll();
    };

    process.on('exit', onExit);
    process.on('SIGINT', () => {
      this.flushAll();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      this.flushAll();
      process.exit(0);
    });
  }
}
