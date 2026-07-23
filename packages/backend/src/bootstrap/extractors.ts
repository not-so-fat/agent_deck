type RecordValue = Record<string, unknown>;

export type AssistantActionSummary = {
  summary: string;
  filePaths: string[];
  toolNames: string[];
  bashCommands: string[];
  skills: string[];
};

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null;
}

function commandTokens(command: string): string[] {
  return command.match(/(?:[^\s"'\\]|\\.)+|"[^"]*"|'[^']*'/g) ?? [];
}

export function normalizeBashCommand(command: string): string {
  const tokens = commandTokens(command);
  let index = 0;

  while (/^[A-Za-z_][\w]*=/.test(tokens[index] ?? '') || /^-/.test(tokens[index] ?? '')) {
    index += 1;
  }

  const significant = tokens.slice(index);
  if (significant.length === 0) {
    return '';
  }

  const [program] = significant;
  // Guard non-alpha program tokens (e.g. `(`, `{`, redirects) — not real commands.
  if (!program || !/^[A-Za-z]/.test(program.replace(/^["']|["']$/g, ''))) {
    return '';
  }

  const bareProgram = program.replace(/^["']|["']$/g, '');
  const tokenCount = bareProgram === 'gh' ? 3 : ['git', 'npm', 'npx'].includes(bareProgram) ? 2 : 1;
  return significant.slice(0, tokenCount).join(' ');
}

export function summarizeAssistantAction(line: unknown): AssistantActionSummary {
  const content = isRecord(line) && isRecord(line.message) ? line.message.content : undefined;
  const toolNames: string[] = [];
  const filePaths: string[] = [];
  const bashCommands: string[] = [];
  const skills: string[] = [];

  if (!Array.isArray(content)) {
    return { summary: '', filePaths, toolNames, bashCommands, skills };
  }

  for (const block of content) {
    if (!isRecord(block) || block.type !== 'tool_use' || typeof block.name !== 'string') {
      continue;
    }

    toolNames.push(block.name);
    const input = isRecord(block.input) ? block.input : {};
    if (block.name === 'Bash' || block.name === 'Shell') {
      if (typeof input.command === 'string') {
        bashCommands.push(input.command);
      }
    }
    if (block.name === 'Skill' && typeof input.skill === 'string' && input.skill.trim()) {
      skills.push(input.skill.trim());
    }
    const filePath =
      typeof input.file_path === 'string' && input.file_path.trim()
        ? input.file_path
        : typeof input.path === 'string' && input.path.trim()
          ? input.path
          : null;
    if ((block.name === 'Edit' || block.name === 'Write' || block.name === 'StrReplace') && filePath) {
      filePaths.push(filePath);
    }
  }

  return {
    summary: toolNames.join(', '),
    filePaths,
    toolNames,
    bashCommands,
    skills,
  };
}

export function extractSkillsFromUserText(text: string): string[] {
  const skills: string[] = [];
  const slash = text.match(/^\s*\/([a-z0-9][\w-]*)/i);
  if (slash) {
    skills.push(slash[1]);
  }

  for (const match of text.matchAll(/<command-name>\s*([^<]+?)\s*<\/command-name>/gi)) {
    const skill = match[1].trim();
    if (skill) {
      skills.push(skill);
    }
  }

  return skills;
}

export function deriveOutcome(commands: { command: string; count: number }[]): {
  signal: 'pr_opened' | 'committed' | 'unknown';
  evidence?: string;
} {
  const pr = commands.find(({ command }) => command.includes('gh pr create'));
  if (pr) {
    return { signal: 'pr_opened', evidence: pr.command };
  }

  const commit = commands.find(({ command }) => command.includes('git commit'));
  if (commit) {
    return { signal: 'committed', evidence: commit.command };
  }

  return { signal: 'unknown' };
}
