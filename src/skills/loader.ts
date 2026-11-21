import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SkillDefinition, SkillFrontmatterSchema } from '../schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_SKILLS_DIR =
  process.env.CHRONICLE_SKILLS_DIR ?? path.resolve(__dirname, '..', '..', 'skills');

export const MAX_DESCRIPTION_WORDS = 30;
export const MAX_PLAYBOOK_WORDS = 450;

export function stripQuotes(str: string): string {
  const s = str.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Strict zero-dependency frontmatter parser for flat SKILL.md headers.
 */
export function parseFrontmatter(rawContent: string): { frontmatter: Record<string, any>; body: string } | null {
  const trimmed = rawContent.trimStart();
  if (!trimmed.startsWith('---')) return null;

  const firstNewline = trimmed.indexOf('\n');
  if (firstNewline === -1) return null;

  const rest = trimmed.slice(firstNewline + 1);
  const closingMatch = rest.match(/\r?\n---\s*(\r?\n|$)/);
  if (!closingMatch || closingMatch.index === undefined) return null;

  const yamlPart = rest.slice(0, closingMatch.index);
  const bodyPart = rest.slice(closingMatch.index + closingMatch[0].length).trim();

  const frontmatter: Record<string, any> = {};
  const lines = yamlPart.split(/\r?\n/);
  let currentKey: string | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;

    // List item for currentKey
    if (trimmedLine.startsWith('- ') && currentKey) {
      const itemValue = stripQuotes(trimmedLine.slice(2).trim());
      if (!Array.isArray(frontmatter[currentKey])) {
        frontmatter[currentKey] = [];
      }
      frontmatter[currentKey].push(itemValue);
      continue;
    }

    const colonIdx = trimmedLine.indexOf(':');
    if (colonIdx !== -1) {
      const key = trimmedLine.slice(0, colonIdx).trim();
      const valueStr = trimmedLine.slice(colonIdx + 1).trim();

      if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
        const inner = valueStr.slice(1, -1).trim();
        frontmatter[key] = inner
          ? inner.split(',').map((s) => stripQuotes(s.trim())).filter(Boolean)
          : [];
        currentKey = key;
      } else if (valueStr === '') {
        frontmatter[key] = [];
        currentKey = key;
      } else {
        currentKey = null;
        const unquoted = stripQuotes(valueStr);
        if (/^-?\d+(\.\d+)?$/.test(unquoted)) {
          frontmatter[key] = Number(unquoted);
        } else if (unquoted.toLowerCase() === 'true') {
          frontmatter[key] = true;
        } else if (unquoted.toLowerCase() === 'false') {
          frontmatter[key] = false;
        } else {
          frontmatter[key] = unquoted;
        }
      }
    }
  }

  return { frontmatter, body: bodyPart };
}

// In-memory cache keyed by canonical file path
const skillCache = new Map<string, SkillDefinition>();

export function clearSkillCache(): void {
  skillCache.clear();
}

export function scanSkillFiles(baseDir: string): string[] {
  if (!fs.existsSync(baseDir)) return [];
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === 'custom') {
          const customDir = path.join(baseDir, 'custom');
          if (fs.existsSync(customDir)) {
            const customEntries = fs.readdirSync(customDir, { withFileTypes: true });
            for (const cEntry of customEntries) {
              if (cEntry.isDirectory()) {
                const skillFile = path.join(customDir, cEntry.name, 'SKILL.md');
                if (fs.existsSync(skillFile)) files.push(skillFile);
              } else if (cEntry.name === 'SKILL.md') {
                files.push(path.join(customDir, 'SKILL.md'));
              }
            }
          }
        } else {
          const skillFile = path.join(baseDir, entry.name, 'SKILL.md');
          if (fs.existsSync(skillFile)) files.push(skillFile);
        }
      }
    }
  } catch (err: any) {
    console.warn(`[chronicle-mcp] Error reading skills directory ${baseDir}:`, err.message);
  }

  return files;
}

export function parseSkillFile(filePath: string): SkillDefinition | null {
  try {
    if (!fs.existsSync(filePath)) return null;

    const stats = fs.statSync(filePath);
    const mtimeMs = stats.mtimeMs;

    const cached = skillCache.get(filePath);
    if (cached && cached.mtimeMs === mtimeMs) {
      return cached;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseFrontmatter(content);
    if (!parsed) {
      console.warn(`[chronicle-mcp] Failed to parse frontmatter in '${filePath}'. Skipping.`);
      return null;
    }

    const valResult = SkillFrontmatterSchema.safeParse(parsed.frontmatter);
    if (!valResult.success) {
      console.warn(
        `[chronicle-mcp] Skill '${filePath}' failed frontmatter validation: ${valResult.error.message}. Skipping.`
      );
      return null;
    }

    const fm = valResult.data;
    const descWords = countWords(fm.description);
    if (descWords > MAX_DESCRIPTION_WORDS) {
      console.warn(
        `[chronicle-mcp] Skill '${fm.id}' description exceeds ${MAX_DESCRIPTION_WORDS} words (${descWords} words). Consider trimming.`
      );
    }

    const bodyWords = countWords(parsed.body);
    if (bodyWords > MAX_PLAYBOOK_WORDS) {
      console.warn(
        `[chronicle-mcp] Skill '${fm.id}' playbook body exceeds ${MAX_PLAYBOOK_WORDS} words (${bodyWords} words). Consider trimming.`
      );
    }

    const isCustom = filePath.includes(path.sep + 'custom' + path.sep) || filePath.includes('/custom/');

    const skillDef: SkillDefinition = {
      id: fm.id,
      name: fm.name,
      description: fm.description,
      triggers: fm.triggers,
      antiTriggers: fm.antiTriggers,
      autoPrefetch: fm.autoPrefetch,
      priority: fm.priority,
      campaignScope: fm.campaignScope,
      toolSequence: fm.toolSequence,
      playbook: parsed.body,
      filePath,
      isCustom,
      mtimeMs,
    };

    skillCache.set(filePath, skillDef);
    return skillDef;
  } catch (err: any) {
    console.warn(`[chronicle-mcp] Error loading skill from '${filePath}':`, err.message);
    return null;
  }
}

export function loadAllSkills(skillsDir?: string): SkillDefinition[] {
  const dir = skillsDir || DEFAULT_SKILLS_DIR;
  const files = scanSkillFiles(dir);
  const activeFiles = new Set(files);

  // Evict removed files from cache
  for (const cachedPath of skillCache.keys()) {
    if (!activeFiles.has(cachedPath)) {
      skillCache.delete(cachedPath);
    }
  }

  const skills: SkillDefinition[] = [];
  const seenIds = new Set<string>();

  for (const file of files) {
    const skill = parseSkillFile(file);
    if (skill) {
      if (seenIds.has(skill.id)) {
        console.warn(`[chronicle-mcp] Duplicate skill id '${skill.id}' in '${file}'. Preserving first loaded.`);
        continue;
      }
      seenIds.add(skill.id);
      skills.push(skill);
    }
  }

  // Sort by priority descending, then id ascending
  skills.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.id.localeCompare(b.id);
  });

  return skills;
}

export function getSkillById(id: string, skillsDir?: string): SkillDefinition | undefined {
  const dir = skillsDir || DEFAULT_SKILLS_DIR;
  const skills = loadAllSkills(dir);
  return skills.find((s) => s.id === id);
}
