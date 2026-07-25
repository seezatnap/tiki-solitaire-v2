import { readFileSync } from 'node:fs';

/** Minimal .env reader — the key never leaves this process. */
export const env = (name) => {
  if (process.env[name]) return process.env[name];
  const raw = readFileSync(new URL('../../.env', import.meta.url), 'utf8');
  for (const line of raw.split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && match[1] === name) return match[2].replace(/^["']|["']$/g, '');
  }
  throw new Error(`${name} not found in .env`);
};

export const KEY = env('OPENAI_API_KEY');
