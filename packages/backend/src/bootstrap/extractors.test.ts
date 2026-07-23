import { describe, expect, it } from 'vitest';
import {
  deriveOutcome,
  extractSkillsFromUserText,
  normalizeBashCommand,
  summarizeAssistantAction,
} from './extractors';

describe('extractors', () => {
  it('summarizes tool calls, paths, commands, and skills', () => {
    expect(
      summarizeAssistantAction({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', name: 'Bash', input: { command: 'git commit -m hi' } },
            { type: 'tool_use', name: 'Edit', input: { file_path: 'src/a.ts' } },
            { type: 'tool_use', name: 'Skill', input: { skill: 'review' } },
          ],
        },
      }),
    ).toMatchObject({
      toolNames: ['Bash', 'Edit', 'Skill'],
      bashCommands: ['git commit -m hi'],
      filePaths: ['src/a.ts'],
      skills: ['review'],
    });
  });

  it('keeps subcommands for git, gh, npm, and npx', () => {
    expect(normalizeBashCommand('git commit -m "x"')).toBe('git commit');
    expect(normalizeBashCommand('gh pr create --fill')).toBe('gh pr create');
    expect(normalizeBashCommand('npm run test -- --runInBand')).toBe('npm run');
    expect(normalizeBashCommand('npx vitest run')).toBe('npx vitest');
  });

  it('extracts skill name from command-name tags in user text', () => {
    expect(extractSkillsFromUserText('use <command-name>foo</command-name>')).toEqual(['foo']);
  });

  it('prefers opened PR outcome over committed outcome', () => {
    expect(
      deriveOutcome([
        { command: 'git commit', count: 1 },
        { command: 'gh pr create', count: 1 },
      ]),
    ).toEqual({ signal: 'pr_opened', evidence: 'gh pr create' });
  });
});
