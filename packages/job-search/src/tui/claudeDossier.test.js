import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, chmodSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  nestedClaudeEnv,
  CLAUDE_ARGS_PREFIX,
  resolveClaudePath,
} from './claudeDossier.js';

// A PATH holding only fake executables with these names, plus /usr/bin for `which`.
function fakePath(names) {
  const dir = mkdtempSync(join(tmpdir(), 'claude-bin-'));
  for (const name of names) {
    writeFileSync(join(dir, name), '#!/bin/sh\n');
    chmodSync(join(dir, name), 0o755);
  }
  return { dir, PATH: `${dir}:/usr/bin:/bin` };
}

describe('resolveClaudePath', () => {
  it('falls back to claude-personal when there is no bare claude', async () => {
    const { dir, PATH } = fakePath(['claude-personal']);
    expect(await resolveClaudePath({ PATH })).toBe(join(dir, 'claude-personal'));
  });

  it('prefers claude over claude-personal', async () => {
    const { dir, PATH } = fakePath(['claude', 'claude-personal']);
    expect(await resolveClaudePath({ PATH })).toBe(join(dir, 'claude'));
  });

  it('lets CLAUDE_BIN name the CLI', async () => {
    const { dir, PATH } = fakePath(['claude', 'claude-work']);
    expect(await resolveClaudePath({ PATH, CLAUDE_BIN: 'claude-work' })).toBe(
      join(dir, 'claude-work')
    );
  });

  it('throws when no CLI is installed', async () => {
    const { PATH } = fakePath([]);
    await expect(resolveClaudePath({ PATH })).rejects.toThrow(/not found/);
  });
});

describe('nestedClaudeEnv', () => {
  it('drops claude-nesting markers but keeps other vars', () => {
    const env = nestedClaudeEnv({
      PATH: '/usr/bin',
      CLAUDECODE: '1',
      CLAUDE_CODE_ENTRYPOINT: 'cli',
      CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: 'x',
      OPENAI_API_KEY: 'sk',
    });
    expect(env.PATH).toBe('/usr/bin');
    expect(env.OPENAI_API_KEY).toBe('sk');
    expect(env.CLAUDECODE).toBeUndefined();
    expect(env.CLAUDE_CODE_ENTRYPOINT).toBeUndefined();
    expect(env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS).toBeUndefined();
  });

  it('does not mutate the source env', () => {
    const src = { CLAUDECODE: '1' };
    nestedClaudeEnv(src);
    expect(src.CLAUDECODE).toBe('1');
  });
});

describe('CLAUDE_ARGS_PREFIX', () => {
  it('requests stream-json with web tools and ends with the arg separator', () => {
    expect(CLAUDE_ARGS_PREFIX).toEqual([
      '--print',
      '--output-format',
      'stream-json',
      '--verbose',
      '--allowedTools',
      'WebSearch',
      'WebFetch',
      '--',
    ]);
  });
});
