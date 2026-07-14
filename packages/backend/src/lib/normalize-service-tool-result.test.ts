import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  SLACK_CONNECT_FILE_HINT,
  SPILL_CHAR_THRESHOLD,
  normalizeServiceToolResult,
} from './normalize-service-tool-result';

const slackService = {
  id: 'svc-slack',
  name: 'Slack',
  url: 'https://mcp.slack.com/mcp',
};

const otherService = {
  id: 'svc-other',
  name: 'Docmost',
  url: 'https://docmost.example.com/mcp',
};

describe('normalizeServiceToolResult', () => {
  let spillDir: string;

  beforeEach(() => {
    spillDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-deck-spill-'));
  });

  afterEach(() => {
    fs.rmSync(spillDir, { recursive: true, force: true });
  });

  it('passes through small successful text results', () => {
    const remote = {
      content: [{ type: 'text', text: 'hello' }],
    };

    const out = normalizeServiceToolResult({
      result: remote,
      service: otherService,
      toolName: 'ping',
      spillDir,
    });

    expect(out).toEqual({
      success: true,
      result: remote,
    });
  });

  it('surfaces isError file_not_found on Slack with Connect hint', () => {
    const remote = {
      isError: true,
      content: [{ type: 'text', text: 'execution_failed: file_not_found' }],
    };

    const out = normalizeServiceToolResult({
      result: remote,
      service: slackService,
      toolName: 'slack_read_file',
      spillDir,
    });

    expect(out.success).toBe(false);
    expect(out.error_code).toBe('MCP_TOOL_ERROR');
    expect(out.error).toMatch(/file_not_found/i);
    expect(out.details?.hint).toBe(SLACK_CONNECT_FILE_HINT);
    expect(out.details?.phase).toBe('callTool');
    expect(out.toolName).toBe('slack_read_file');
    expect(out.serviceName).toBe('Slack');
  });

  it('surfaces file_not_found on non-Slack without Connect hint', () => {
    const remote = {
      isError: true,
      content: [{ type: 'text', text: 'file_not_found' }],
    };

    const out = normalizeServiceToolResult({
      result: remote,
      service: otherService,
      toolName: 'read_file',
      spillDir,
    });

    expect(out.success).toBe(false);
    expect(out.details?.hint).toBeUndefined();
    expect(out.details?.cause).toMatch(/file_not_found/i);
  });

  it('spills oversized serialized payloads to disk', () => {
    const big = 'Hello world! '.repeat(Math.ceil((SPILL_CHAR_THRESHOLD + 100) / 13));
    const remote = {
      content: [{ type: 'text', text: big }],
    };

    const out = normalizeServiceToolResult({
      result: remote,
      service: otherService,
      toolName: 'read_big',
      spillDir,
    });

    expect(out.success).toBe(true);
    expect(out.result).toMatchObject({
      spilled: true,
      originalTool: 'read_big',
      mimeType: 'text/plain',
    });
    const spilledPath = (out.result as { path: string }).path;
    expect(spilledPath.startsWith(spillDir)).toBe(true);
    expect(fs.existsSync(spilledPath)).toBe(true);
    expect(fs.statSync(spilledPath).size).toBeGreaterThan(SPILL_CHAR_THRESHOLD);
  });

  it('spills base64 binary content as decoded bytes', () => {
    const bytes = Buffer.alloc(200, 0x41);
    bytes.write('%PDF-1.4');
    const b64 = bytes.toString('base64');
    expect(b64.length).toBeGreaterThanOrEqual(256);

    const remote = {
      content: [{ type: 'text', text: b64, mimeType: 'application/pdf' }],
    };

    const out = normalizeServiceToolResult({
      result: remote,
      service: slackService,
      toolName: 'slack_read_file',
      spillDir,
    });

    expect(out.success).toBe(true);
    expect(out.result).toMatchObject({
      spilled: true,
      mimeType: 'application/pdf',
      originalTool: 'slack_read_file',
      size: bytes.length,
    });
    const spilledPath = (out.result as { path: string }).path;
    expect(spilledPath.endsWith('.pdf')).toBe(true);
    expect(fs.readFileSync(spilledPath).equals(bytes)).toBe(true);
  });

  it('spills image content blocks regardless of size', () => {
    const remote = {
      content: [{
        type: 'image',
        mimeType: 'image/png',
        data: Buffer.from('tiny').toString('base64'),
      }],
    };

    const out = normalizeServiceToolResult({
      result: remote,
      service: otherService,
      toolName: 'get_icon',
      spillDir,
    });

    expect(out.success).toBe(true);
    expect(out.result).toMatchObject({
      spilled: true,
      mimeType: 'image/png',
    });
    const spilledPath = (out.result as { path: string }).path;
    expect(fs.readFileSync(spilledPath).equals(Buffer.from('tiny'))).toBe(true);
  });
});
