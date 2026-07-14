import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { Service, ServiceCallResult } from '@agent-deck/shared';
import { resolveAgentDeckHome } from './paths';

export const SPILL_CHAR_THRESHOLD = 48_000;
export const BASE64_MIN_CHARS = 256;

export const SLACK_CONNECT_FILE_HINT =
  'Possibly an external Slack Connect file — bytes may be unreachable with this token; retry will not help. Ask an internal member to re-upload or share a download link.';

const BINARY_MIME_RE =
  /^(image\/|audio\/|video\/|application\/pdf|application\/octet-stream)/i;

const BASE64_RE = /^[A-Za-z0-9+/=\s]+$/;

export interface NormalizeServiceToolInput {
  result: unknown;
  service: Pick<Service, 'id' | 'name' | 'url'>;
  toolName: string;
  /** Override for tests; default `~/.agent-deck/tool-results`. */
  spillDir?: string;
}

type ContentBlock = {
  type?: string;
  text?: string;
  data?: string;
  mimeType?: string;
  blob?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getContentBlocks(result: unknown): ContentBlock[] {
  if (!isRecord(result)) {
    return [];
  }
  const content = result.content;
  if (!Array.isArray(content)) {
    return [];
  }
  return content.filter((b): b is ContentBlock => isRecord(b));
}

export function flattenToolResultText(result: unknown): string {
  const blocks = getContentBlocks(result);
  if (blocks.length > 0) {
    return blocks
      .map((b) => (typeof b.text === 'string' ? b.text : ''))
      .filter(Boolean)
      .join('\n');
  }

  if (isRecord(result) && typeof result.error === 'string') {
    return result.error;
  }

  try {
    return JSON.stringify(result) ?? '';
  } catch {
    return String(result ?? '');
  }
}

export function isInBandToolError(result: unknown): boolean {
  if (isRecord(result) && result.isError === true) {
    return true;
  }

  const text = flattenToolResultText(result);
  if (/file_not_found|execution_failed/i.test(text)) {
    return true;
  }

  return false;
}

export function isSlackService(service: Pick<Service, 'name' | 'url'>): boolean {
  return /slack/i.test(`${service.name} ${service.url}`);
}

function shortErrorLabel(cause: string): string {
  const fileNotFound = cause.match(/file_not_found/i);
  if (fileNotFound) {
    return 'file_not_found';
  }
  const executionFailed = cause.match(/execution_failed[^\n]*/i);
  if (executionFailed) {
    return executionFailed[0].slice(0, 120);
  }
  const trimmed = cause.trim();
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed || 'Tool error';
}

function lookLikeBase64(value: string): boolean {
  const compact = value.replace(/\s+/g, '');
  if (compact.length < BASE64_MIN_CHARS) {
    return false;
  }
  if (!BASE64_RE.test(compact)) {
    return false;
  }
  // Length typically multiple of 4 for standard base64
  if (compact.length % 4 !== 0) {
    return false;
  }
  try {
    const decoded = Buffer.from(compact, 'base64');
    if (decoded.length === 0) {
      return false;
    }
    if (decoded.toString('base64').replace(/=+$/, '') !== compact.replace(/=+$/, '')) {
      return false;
    }
    // Real binary→base64 uses a mixed alphabet; reject low-entropy runs like "xxxx…"
    const unique = new Set(compact).size;
    if (unique < 12) {
      return false;
    }
    return isLikelyBinaryPayload(decoded);
  } catch {
    return false;
  }
}

/** Avoid treating long ASCII strings as base64 (e.g. repeated 'x'). */
function isLikelyBinaryPayload(decoded: Buffer): boolean {
  if (decoded.length >= 5 && decoded.subarray(0, 5).toString('utf8') === '%PDF-') {
    return true;
  }
  if (
    decoded.length >= 8
    && decoded[0] === 0x89
    && decoded[1] === 0x50
    && decoded[2] === 0x4e
    && decoded[3] === 0x47
  ) {
    return true;
  }
  if (decoded.length >= 3 && decoded[0] === 0xff && decoded[1] === 0xd8 && decoded[2] === 0xff) {
    return true;
  }

  const sample = decoded.subarray(0, Math.min(512, decoded.length));
  if (sample.length === 0) {
    return false;
  }
  let nonText = 0;
  for (const b of sample) {
    if (b === 0 || (b < 9) || (b > 13 && b < 32) || b === 127) {
      nonText += 1;
    }
  }
  return nonText / sample.length > 0.15;
}

function extensionForMime(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower === 'application/pdf') return '.pdf';
  if (lower === 'image/png') return '.png';
  if (lower === 'image/jpeg' || lower === 'image/jpg') return '.jpg';
  if (lower === 'image/gif') return '.gif';
  if (lower === 'image/webp') return '.webp';
  if (lower.startsWith('text/')) return '.txt';
  if (lower === 'application/json') return '.json';
  return '.bin';
}

function resolveDefaultSpillDir(): string {
  return path.join(resolveAgentDeckHome(), 'tool-results');
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writeSpillFile(
  spillDir: string,
  bytes: Buffer,
  mimeType: string,
): { path: string; size: number; mimeType: string } {
  ensureDir(spillDir);
  const filePath = path.join(spillDir, `${randomUUID()}${extensionForMime(mimeType)}`);
  fs.writeFileSync(filePath, bytes);
  return { path: filePath, size: bytes.length, mimeType };
}

function findSpillCandidate(result: unknown): {
  bytes: Buffer;
  mimeType: string;
} | null {
  const blocks = getContentBlocks(result);

  for (const block of blocks) {
    const mime =
      (typeof block.mimeType === 'string' && block.mimeType)
      || (block.type === 'image' ? 'image/png' : undefined);

    const isBinaryBlock =
      block.type === 'image'
      || block.type === 'resource'
      || block.type === 'blob'
      || (mime != null && BINARY_MIME_RE.test(mime));

    if (isBinaryBlock) {
      const raw = typeof block.data === 'string'
        ? block.data
        : typeof block.blob === 'string'
          ? block.blob
          : typeof block.text === 'string'
            ? block.text
            : null;
      if (raw != null) {
        const compact = raw.replace(/\s+/g, '');
        const preferBase64 =
          block.type === 'image'
          || block.type === 'blob'
          || lookLikeBase64(compact);
        try {
          const bytes = preferBase64
            ? Buffer.from(compact, 'base64')
            : Buffer.from(raw, 'utf8');
          return { bytes, mimeType: mime || 'application/octet-stream' };
        } catch {
          return { bytes: Buffer.from(raw, 'utf8'), mimeType: mime || 'application/octet-stream' };
        }
      }
    }

    if (typeof block.text === 'string' && lookLikeBase64(block.text)) {
      const compact = block.text.replace(/\s+/g, '');
      const mimeFromBlock = typeof block.mimeType === 'string' ? block.mimeType : 'application/octet-stream';
      return {
        bytes: Buffer.from(compact, 'base64'),
        mimeType: mimeFromBlock,
      };
    }
  }

  // Nested JSON string fields that look like base64 (Slack sometimes wraps)
  if (isRecord(result)) {
    const nested = findNestedBase64(result);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function findNestedBase64(
  value: unknown,
  depth = 0,
): { bytes: Buffer; mimeType: string } | null {
  if (depth > 6 || value == null) {
    return null;
  }
  if (typeof value === 'string') {
    if (lookLikeBase64(value)) {
      const compact = value.replace(/\s+/g, '');
      return { bytes: Buffer.from(compact, 'base64'), mimeType: 'application/octet-stream' };
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNestedBase64(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (isRecord(value)) {
    const mime = typeof value.mimeType === 'string' ? value.mimeType : undefined;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'mimeType') continue;
      if (typeof child === 'string' && lookLikeBase64(child)) {
        const compact = child.replace(/\s+/g, '');
        return {
          bytes: Buffer.from(compact, 'base64'),
          mimeType: mime || (BINARY_MIME_RE.test(mime ?? '') ? mime! : 'application/octet-stream'),
        };
      }
      const found = findNestedBase64(child, depth + 1);
      if (found) {
        return {
          bytes: found.bytes,
          mimeType: mime && BINARY_MIME_RE.test(mime) ? mime : found.mimeType,
        };
      }
    }
  }
  return null;
}

function serializedLength(result: unknown): number {
  try {
    return JSON.stringify(result)?.length ?? 0;
  } catch {
    return String(result).length;
  }
}

/**
 * Inspect a remote MCP tool result: surface in-band errors, spill binaries / oversized payloads.
 */
export function normalizeServiceToolResult(input: NormalizeServiceToolInput): ServiceCallResult {
  const { result, service, toolName } = input;
  const spillDir = input.spillDir ?? resolveDefaultSpillDir();

  if (isInBandToolError(result)) {
    const cause = flattenToolResultText(result) || 'Tool error';
    const hint =
      isSlackService(service) && /file_not_found/i.test(cause)
        ? SLACK_CONNECT_FILE_HINT
        : undefined;

    return {
      success: false,
      error: shortErrorLabel(cause),
      error_code: 'MCP_TOOL_ERROR',
      details: {
        service_id: service.id,
        service_name: service.name,
        remote_url: service.url,
        tool_name: toolName,
        cause,
        phase: 'callTool',
        ...(hint ? { hint } : {}),
      },
      serviceName: service.name,
      toolName,
    };
  }

  const binary = findSpillCandidate(result);
  if (binary) {
    const spilled = writeSpillFile(spillDir, binary.bytes, binary.mimeType);
    return {
      success: true,
      result: {
        spilled: true,
        path: spilled.path,
        mimeType: spilled.mimeType,
        size: spilled.size,
        originalTool: toolName,
      },
    };
  }

  if (serializedLength(result) >= SPILL_CHAR_THRESHOLD) {
    const text = flattenToolResultText(result) || JSON.stringify(result);
    const spilled = writeSpillFile(spillDir, Buffer.from(text, 'utf8'), 'text/plain');
    return {
      success: true,
      result: {
        spilled: true,
        path: spilled.path,
        mimeType: spilled.mimeType,
        size: spilled.size,
        originalTool: toolName,
      },
    };
  }

  return {
    success: true,
    result,
  };
}
