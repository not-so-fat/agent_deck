import { describe, expect, it } from 'vitest';

import {
  CLI_DEFAULT_BACKEND_PORT,
  CLI_DEFAULT_MCP_PORT,
  parseCliBackendPort,
  parseCliMcpPort,
} from './defaults';

describe('cli defaults', () => {
  it('uses rare ports for npx install defaults', () => {
    expect(CLI_DEFAULT_BACKEND_PORT).toBe(11111);
    expect(CLI_DEFAULT_MCP_PORT).toBe(11112);
  });

  it('parses env overrides', () => {
    expect(parseCliBackendPort('9000')).toBe(9000);
    expect(parseCliMcpPort('9002')).toBe(9002);
  });

  it('falls back when env is invalid', () => {
    expect(parseCliBackendPort(undefined)).toBe(11111);
    expect(parseCliMcpPort('nope')).toBe(11112);
  });
});
