export type MemoryKind = 'fact' | 'preference' | 'goal' | 'project' | 'experience' | 'other';
export type MemorySensitivity = 'ordinary' | 'sensitive';
export type MemorySource = 'user_created' | 'user_confirmed' | 'imported';

export type MemoryRecord = {
  id: string;
  content: string;
  kind: MemoryKind;
  sensitivity: MemorySensitivity;
  source: MemorySource;
  consentedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = 'amstreem.memories.v1';
const MAX_CONTENT_LENGTH = 8000;

const kinds: MemoryKind[] = ['fact', 'preference', 'goal', 'project', 'experience', 'other'];
const sensitivities: MemorySensitivity[] = ['ordinary', 'sensitive'];
const sources: MemorySource[] = ['user_created', 'user_confirmed', 'imported'];

function isMemoryRecord(value: unknown): value is MemoryRecord {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' &&
    typeof item.content === 'string' &&
    item.content.length > 0 && item.content.length <= MAX_CONTENT_LENGTH &&
    kinds.includes(item.kind as MemoryKind) &&
    sensitivities.includes(item.sensitivity as MemorySensitivity) &&
    sources.includes(item.source as MemorySource) &&
    (item.consentedAt === null || typeof item.consentedAt === 'string') &&
    typeof item.createdAt === 'string' &&
    typeof item.updatedAt === 'string';
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `memory-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Reads only Amstreem's explicit memory store. It never imports browser captures automatically. */
export function readMemories(): MemoryRecord[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isMemoryRecord) : [];
  } catch {
    return [];
  }
}

/** Persists only records the user explicitly created or confirmed. */
export function writeMemories(records: MemoryRecord[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function createMemory(input: {
  content: string;
  kind: MemoryKind;
  sensitivity: MemorySensitivity;
}): MemoryRecord {
  const content = input.content.trim();
  if (!content || content.length > MAX_CONTENT_LENGTH) {
    throw new Error(`Memory must contain between 1 and ${MAX_CONTENT_LENGTH} characters.`);
  }
  const now = new Date().toISOString();
  return {
    id: createId(),
    content,
    kind: input.kind,
    sensitivity: input.sensitivity,
    source: 'user_created',
    consentedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateMemory(
  records: MemoryRecord[],
  id: string,
  changes: Pick<MemoryRecord, 'content' | 'kind' | 'sensitivity'>,
): MemoryRecord[] {
  const content = changes.content.trim();
  if (!content || content.length > MAX_CONTENT_LENGTH) {
    throw new Error(`Memory must contain between 1 and ${MAX_CONTENT_LENGTH} characters.`);
  }
  return records.map(record => record.id === id
    ? { ...record, ...changes, content, updatedAt: new Date().toISOString() }
    : record);
}

export function exportMemories(records: MemoryRecord[]): void {
  const blob = new Blob([JSON.stringify({
    format: 'amstreem-memory-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    memories: records,
  }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'amstreem-memories.json';
  link.click();
  URL.revokeObjectURL(url);
}
