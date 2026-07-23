import { describe, expect, it } from 'vitest';
import {
  extractUserText,
  isCursorHostInjection,
  isRealUserIntent,
  unwrapCursorUserEnvelope,
} from './real-intent';

function cursorUser(text: string): unknown {
  return {
    role: 'user',
    message: { role: 'user', content: [{ type: 'text', text }] },
  };
}

describe('unwrapCursorUserEnvelope', () => {
  it('strips timestamp and unwraps user_query', () => {
    const raw =
      '<timestamp>Saturday, Jul 11, 2026, 10:49 AM (UTC-7)</timestamp>\n<user_query>\nbind dev deck\n</user_query>';
    expect(unwrapCursorUserEnvelope(raw)).toBe('bind dev deck');
  });

  it('leaves Claude-style plain text alone', () => {
    expect(unwrapCursorUserEnvelope('plain intent')).toBe('plain intent');
  });
});

describe('Cursor host injections', () => {
  it('detects Briefly-inform injection', () => {
    const raw =
      '<user_query>Briefly inform the user about the task result and perform any follow-up actions (if needed). If there\'s no follow-ups needed, don\'t explicitly say that.</user_query>';
    expect(isCursorHostInjection(raw)).toBe(true);
    expect(isRealUserIntent(cursorUser(raw))).toBe(false);
  });

  it('rejects mcp_meta_tools user-role chrome', () => {
    expect(isRealUserIntent(cursorUser('<mcp_meta_tools>\nYou have access'))).toBe(false);
  });

  it('accepts timestamp+user_query real turns', () => {
    const raw =
      '<timestamp>Saturday, Jul 11, 2026, 10:49 AM (UTC-7)</timestamp>\n<user_query>\nbind dev deck\n</user_query>';
    expect(isRealUserIntent(cursorUser(raw))).toBe(true);
    expect(extractUserText(cursorUser(raw))).toBe('bind dev deck');
  });

  it('accepts legacy bare user_query without timestamp', () => {
    const raw = '<user_query>\nshow me agent deck\n</user_query>';
    expect(isRealUserIntent(cursorUser(raw))).toBe(true);
    expect(extractUserText(cursorUser(raw))).toBe('show me agent deck');
  });
});
