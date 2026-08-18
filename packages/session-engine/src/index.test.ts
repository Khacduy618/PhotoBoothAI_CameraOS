import { describe, expect, it } from 'vitest';

import { createIdleSession, reduceGuestSession } from './index';

const photo = {
  id: 'photo_1',
  sessionId: 'session_1',
  relativePath: 'sessions/session_1/originals/01.jpg',
  mimeType: 'image/jpeg',
  createdAt: '2026-08-12T00:00:00.000Z',
};

const output = {
  id: 'output_1',
  sessionId: 'session_1',
  relativePath: 'sessions/session_1/output/final.jpg',
  mimeType: 'image/jpeg',
  createdAt: '2026-08-12T00:00:00.000Z',
};

describe('WindowMini session engine', () => {
  it('runs the approved guest flow transition sequence', () => {
    let result = reduceGuestSession(createIdleSession(), { type: 'CREATE_SESSION', sessionId: 'session_1', eventId: 'event_1' });
    expect(result.ok && result.value.state).toBe('SELECTING_FORMAT');
    if (!result.ok) throw new Error('create failed');

    result = reduceGuestSession(result.value, { type: 'SELECT_FORMAT', formatId: 'format_4shot' });
    expect(result.ok && result.value.state).toBe('READY_TO_CAPTURE');
    if (!result.ok) throw new Error('format failed');

    result = reduceGuestSession(result.value, { type: 'START_CAPTURE' });
    expect(result.ok && result.value.state).toBe('CAPTURING');
    if (!result.ok) throw new Error('capture start failed');

    result = reduceGuestSession(result.value, { type: 'CAPTURE_COMPLETE', photos: [photo] });
    expect(result.ok && result.value.state).toBe('SELECTING_TEMPLATE');
    if (!result.ok) throw new Error('capture complete failed');

    result = reduceGuestSession(result.value, { type: 'SELECT_TEMPLATE', templateId: 'template_1', allowsCustomization: false });
    expect(result.ok && result.value.state).toBe('COMPOSING');
    if (!result.ok) throw new Error('template failed');

    result = reduceGuestSession(result.value, { type: 'COMPOSITION_COMPLETE', outputs: { master: output, share: output, print: output } });
    expect(result.ok && result.value.state).toBe('RESULT_READY');
  });

  it('rejects invalid transitions explicitly', () => {
    const result = reduceGuestSession(createIdleSession(), { type: 'START_CAPTURE' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_SESSION_TRANSITION');
  });
});
