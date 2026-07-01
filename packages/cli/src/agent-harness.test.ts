import { describe, expect, it } from 'vitest';

import {
  buildClaudeHarnessBlock,
  buildCursorHarnessFile,
  CURSOR_RULE_FILENAME,
  HARNESS_MARKER_END,
  HARNESS_MARKER_START,
  HARNESS_RULE_DESCRIPTION,
  mergeClaudeHarness,
  mergeCursorHarnessFile,
} from './agent-harness';

describe('agent-harness templates', () => {
  it('keeps cursor description concise (skill-style)', () => {
    expect(HARNESS_RULE_DESCRIPTION.length).toBeLessThan(120);
    expect(CURSOR_RULE_FILENAME).toBe('agent-deck.mdc');
  });

  it('global cursor file includes self-improvement playbook rules', () => {
    const file = buildCursorHarnessFile('global');
    expect(file).toContain('list_playbooks');
    expect(file).toContain('update_playbook');
    expect(file).toContain('get_playbook');
    expect(file).toContain('this session');
    expect(file).toContain("don't infer from playbook title");
    expect(file).toContain('Do both');
    expect(file).toContain('Generalize');
    expect(file).toContain('audit drift');
    expect(file).not.toContain('weekly priority');
  });

  it('project cursor file adds repo bind line', () => {
    const file = buildCursorHarnessFile('project');
    expect(file).toContain('bind_workspace');
    expect(file).toContain('this repo');
  });

  it('claude block avoids project-specific examples', () => {
    const block = buildClaudeHarnessBlock('global');
    expect(block).toContain('## Agent Deck');
    expect(block).not.toContain('DocMost');
    expect(block).not.toContain('slip-risk');
  });
});

describe('mergeClaudeHarness', () => {
  it('appends harness block when missing', () => {
    const { content, changed } = mergeClaudeHarness('# My notes\n', buildClaudeHarnessBlock('global'));
    expect(changed).toBe(true);
    expect(content).toContain('<!-- agent-deck:harness:start -->');
    expect(content).toContain('## Agent Deck');
    expect(content).toContain('# My notes');
  });

  it('preserves content before and after harness markers', () => {
    const existing = [
      '# Team conventions',
      '',
      HARNESS_MARKER_START,
      'old harness',
      HARNESS_MARKER_END,
      '',
      '# More notes',
    ].join('\n');
    const { content } = mergeClaudeHarness(existing, buildClaudeHarnessBlock('global'));
    expect(content).toContain('# Team conventions');
    expect(content).toContain('# More notes');
    expect(content).toContain('## Agent Deck');
    expect(content).not.toContain('old harness');
  });

  it('replaces existing harness block idempotently', () => {
    const first = mergeClaudeHarness('', buildClaudeHarnessBlock('global'));
    const second = mergeClaudeHarness(first.content, buildClaudeHarnessBlock('global'));
    expect(second.changed).toBe(false);
    expect(second.content).toBe(first.content);
  });

  it('updates when harness body changes', () => {
    const initial = mergeClaudeHarness('', buildClaudeHarnessBlock('global'));
    const updated = mergeClaudeHarness(initial.content, `${buildClaudeHarnessBlock('global')}\n\nExtra.`);
    expect(updated.changed).toBe(true);
    expect(updated.content).toContain('Extra.');
  });
});

describe('mergeCursorHarnessFile', () => {
  it('preserves custom frontmatter and trailing notes in agent-deck.mdc', () => {
    const existing = `---
description: My custom description
alwaysApply: true
---

# My preamble

${HARNESS_MARKER_START}
old
${HARNESS_MARKER_END}

# Keep this footer
`;
    const { content } = mergeCursorHarnessFile(existing, '# Agent Deck\n\nnew body');
    expect(content).toContain('description: My custom description');
    expect(content).toContain('# My preamble');
    expect(content).toContain('# Keep this footer');
    expect(content).toContain('new body');
    expect(content).not.toContain('old');
  });

  it('appends harness when agent-deck.mdc has content but no markers', () => {
    const existing = `---
description: Custom
alwaysApply: false
---

# Existing rule intro
`;
    const { content, changed } = mergeCursorHarnessFile(existing, '# Agent Deck\n\nbody');
    expect(changed).toBe(true);
    expect(content).toContain('# Existing rule intro');
    expect(content).toContain(HARNESS_MARKER_START);
  });

  it('only touches agent-deck.mdc filename (not other rules)', () => {
    expect(CURSOR_RULE_FILENAME).toBe('agent-deck.mdc');
    expect(buildCursorHarnessFile('global')).toContain(HARNESS_MARKER_START);
  });
});
