import { TranscriptEntry, Role } from '../types';

const MAX_TOKEN_ESTIMATE = 8000;
const AVG_CHARS_PER_TOKEN = 4;
const MAX_CHARS = MAX_TOKEN_ESTIMATE * AVG_CHARS_PER_TOKEN;

export class TranscriptBuilder {
  private entries: TranscriptEntry[] = [];

  append(speaker: string, role: Role | 'JUDGE', text: string): TranscriptEntry {
    const entry: TranscriptEntry = {
      speaker,
      role,
      text,
      timestamp: Date.now(),
    };
    this.entries.push(entry);
    this.enforceLimit();
    return entry;
  }

  /** Merge into last entry if same speaker within a few seconds (streaming STT chunks). */
  appendOrMerge(speaker: string, role: Role | 'JUDGE', text: string): TranscriptEntry {
    const last = this.entries[this.entries.length - 1];
    const now = Date.now();
    if (
      last &&
      last.speaker === speaker &&
      last.role === role &&
      now - last.timestamp < 4000
    ) {
      last.text = `${last.text}${last.text.endsWith(' ') || text.startsWith(' ') ? '' : ' '}${text}`.trim();
      last.timestamp = now;
      this.enforceLimit();
      return last;
    }
    return this.append(speaker, role, text);
  }

  getAll(): TranscriptEntry[] {
    return [...this.entries];
  }

  serialize(): string {
    return this.entries
      .map(e => `[${e.role}] ${e.speaker}: ${e.text}`)
      .join('\n');
  }

  serializeForGemini(): string {
    return this.entries
      .map(e => `[${e.role}] ${e.speaker}: ${e.text}`)
      .join('\n');
  }

  private enforceLimit(): void {
    let totalChars = this.entries.reduce((sum, e) => sum + e.text.length + e.speaker.length + 20, 0);

    while (totalChars > MAX_CHARS && this.entries.length > 1) {
      const removed = this.entries.shift()!;
      totalChars -= removed.text.length + removed.speaker.length + 20;
    }
  }

  clear(): void {
    this.entries = [];
  }
}
