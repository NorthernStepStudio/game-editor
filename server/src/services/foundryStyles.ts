import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Saved art styles: a name plus a description that is appended to every asset
 * request using it, so assets and packs stay visually consistent.
 */
export interface FoundryStyle {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly createdAt: string;
}

const MAX_STYLES = 100;

export class FoundryStyleStore {
  private readonly path: string;
  private styles: FoundryStyle[] = [];

  constructor(dataDirectory: string) {
    this.path = resolve(dataDirectory, 'foundry-assets', 'styles.json');
    if (existsSync(this.path)) {
      try {
        const parsed = JSON.parse(readFileSync(this.path, 'utf8')) as { styles?: FoundryStyle[] };
        this.styles = Array.isArray(parsed.styles) ? parsed.styles.slice(0, MAX_STYLES) : [];
      } catch {
        this.styles = [];
      }
    }
  }

  list(): readonly FoundryStyle[] {
    return structuredClone(this.styles);
  }

  get(id: string): FoundryStyle | undefined {
    const style = this.styles.find((candidate) => candidate.id === id);
    return style ? structuredClone(style) : undefined;
  }

  create(raw: unknown): FoundryStyle {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (!name || name.length > 60) throw new Error('Give the style a name (up to 60 characters).');
    if (description.length < 3 || description.length > 1000) {
      throw new Error('Describe the style in a few words (up to 1000 characters).');
    }
    if (this.styles.length >= MAX_STYLES) throw new Error('Style limit reached; delete one first.');
    if (this.styles.some((style) => style.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('A style with that name already exists.');
    }
    const style: FoundryStyle = { id: randomUUID(), name, description, createdAt: new Date().toISOString() };
    this.styles.push(style);
    this.persist();
    return structuredClone(style);
  }

  delete(id: string): boolean {
    const before = this.styles.length;
    this.styles = this.styles.filter((style) => style.id !== id);
    if (this.styles.length === before) return false;
    this.persist();
    return true;
  }

  private persist(): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const temp = `${this.path}.tmp`;
    writeFileSync(temp, JSON.stringify({ version: 1, styles: this.styles }, null, 2), 'utf8');
    renameSync(temp, this.path);
  }
}
