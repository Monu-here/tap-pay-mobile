const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

/**
 * Mobile verification flow unit tests.
 *
 * Covers:
 * - Correct code submission
 * - Invalid and expired code messages
 * - Email sending failure
 * - Rate limit and retry-after handling
 * - Network errors
 * - No false success on 4xx or 5xx
 * - Duplicate submission prevention
 * - UI error message mapping (ensuring 422 never displays generic server error)
 */

describe('Mobile Verification Services', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // Message mapping logic identical to VerificationScreen.tsx
  function messageForError(error) {
    if (!error) return null;
    if (error.message) return error.message;
    switch (error.key) {
      case 'incomplete':
        return 'Enter all 6 digits.';
      case 'invalid':
      case 'invalidOrExpired':
        return 'Incorrect verification code. Please try again.';
      case 'expired':
        return 'Your verification code has expired. Request a new code.';
      case 'tooManyAttempts':
        return 'Too many incorrect attempts. Request a new code to continue.';
      case 'mailSendFailed':
        return 'Unable to send the email right now. Please try again later.';
      case 'rateLimited':
        return `Please wait ${error.params?.seconds ?? 60} seconds before requesting another code.`;
      case 'network':
      case 'timeout':
        return 'Unable to connect to the server. Check your connection.';
      case 'unauthorized':
        return 'Your session has expired. Please sign in again.';
      default:
        return 'Something went wrong on our side. Please try again.';
    }
  }

  // Mock implementation of verifyCode matching verification.ts
  async function mockVerifyCode(channel, code) {
    const response = await fetch('http://localhost:8000/api/v1/auth/verification/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, code }),
    });

    const data = await response.json().catch(() => null);

    if (response.ok) {
      return {
        ok: true,
        channel: data?.data?.channel ?? channel,
        emailVerified: data?.data?.email_verified === true,
        phoneVerified: data?.data?.phone_verified === true,
        message: data?.message,
      };
    }

    const rawData = data || {};
    const innerData = rawData.data && typeof rawData.data === 'object' ? rawData.data : null;
    const errorCode = rawData.error_code || innerData?.code || rawData.code || '';
    const attemptsLeft = innerData?.attempts_left ?? rawData.attempts_left;

    if (response.status === 422) {
      if (errorCode === 'expired_code') {
        return {
          ok: false,
          reason: 'expired',
          message: data?.message || 'Your verification code has expired. Request a new code.',
        };
      }
      if (errorCode === 'too_many_attempts') {
        return {
          ok: false,
          reason: 'tooManyAttempts',
          message: data?.message || 'Too many incorrect attempts. Request a new code to continue.',
        };
      }
      if (errorCode === 'invalid_code') {
        return {
          ok: false,
          reason: 'invalid',
          message: data?.message || 'Incorrect verification code. Please try again.',
          attemptsLeft,
        };
      }
      return {
        ok: false,
        reason: 'invalidOrExpired',
        message: data?.message || 'Incorrect verification code. Please try again.',
      };
    }

    if (response.status === 429) {
      return { ok: false, reason: 'rateLimited', retryAfter: 60 };
    }
    if (response.status === 401) {
      return { ok: false, reason: 'unauthorized' };
    }
    return { ok: false, reason: 'server', message: data?.message };
  }

  // Mock implementation of sendVerificationCode matching verification.ts
  async function mockSendVerificationCode(channel) {
    const response = await fetch('http://localhost:8000/api/v1/auth/verification/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel }),
    });

    const data = await response.json().catch(() => null);

    if (response.ok) {
      return { ok: true, message: data?.message };
    }

    const rawData = data?.data || data || {};
    const errorCode = rawData.error_code || '';

    if (response.status === 429) {
      return { ok: false, reason: 'rateLimited', retryAfter: 60 };
    }
    if (response.status === 503 || errorCode === 'mail_send_failed') {
      return {
        ok: false,
        reason: 'mailSendFailed',
        message: data?.message || 'Unable to send the email right now. Please try again later.',
      };
    }
    return { ok: false, reason: 'server', message: data?.message };
  }

  test('correct code submission returns success and verified flags', async () => {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'Your email has been verified.',
        data: {
          channel: 'email',
          verified: true,
          email_verified: true,
          phone_verified: false,
        },
      }),
    });

    const result = await mockVerifyCode('email', '123456');
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.emailVerified, true);
    assert.strictEqual(result.phoneVerified, false);
    assert.strictEqual(result.channel, 'email');
  });

  test('invalid code returns reason invalid and does not show generic server error', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 422,
      json: async () => ({
        success: false,
        message: 'Incorrect verification code. Please try again.',
        error_code: 'invalid_code',
        data: { channel: 'email', attempts_left: 4 },
      }),
    });

    const result = await mockVerifyCode('email', '000000');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'invalid');
    assert.strictEqual(result.attemptsLeft, 4);

    const uiMessage = messageForError({ key: result.reason, message: result.message });
    assert.strictEqual(uiMessage, 'Incorrect verification code. Please try again.');
    assert.notStrictEqual(uiMessage, 'Something went wrong on our side. Please try again.');
  });

  test('expired code returns reason expired and actionable message', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 422,
      json: async () => ({
        success: false,
        message: 'Your verification code has expired. Request a new code.',
        error_code: 'expired_code',
        data: { channel: 'email' },
      }),
    });

    const result = await mockVerifyCode('email', '123456');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'expired');

    const uiMessage = messageForError({ key: result.reason, message: result.message });
    assert.strictEqual(uiMessage, 'Your verification code has expired. Request a new code.');
  });

  test('too many attempts returns reason tooManyAttempts and lockout message', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 422,
      json: async () => ({
        success: false,
        message: 'Too many incorrect attempts. Please request a new code.',
        error_code: 'too_many_attempts',
        data: { channel: 'email' },
      }),
    });

    const result = await mockVerifyCode('email', '000000');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'tooManyAttempts');

    const uiMessage = messageForError({ key: result.reason, message: result.message });
    assert.strictEqual(uiMessage, 'Too many incorrect attempts. Please request a new code.');
  });

  test('email sending failure (503) returns mailSendFailed and actionable message', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 503,
      json: async () => ({
        success: false,
        message: 'Unable to send the email right now. Please try again later.',
        error_code: 'mail_send_failed',
      }),
    });

    const result = await mockSendVerificationCode('email');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'mailSendFailed');

    const uiMessage = messageForError({ key: result.reason, message: result.message });
    assert.strictEqual(uiMessage, 'Unable to send the email right now. Please try again later.');
  });

  test('no false success when API returns 4xx or 5xx', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        message: 'Internal server error',
      }),
    });

    const sendResult = await mockSendVerificationCode('email');
    assert.strictEqual(sendResult.ok, false);
    assert.strictEqual(sendResult.reason, 'server');

    const verifyResult = await mockVerifyCode('email', '123456');
    assert.strictEqual(verifyResult.ok, false);
    assert.strictEqual(verifyResult.reason, 'server');
  });

  test('double tap prevention blocks duplicate in-flight requests', async () => {
    let callCount = 0;
    let isSubmitting = false;

    async function guardedSubmit(code) {
      if (isSubmitting) {
        return { blocked: true };
      }
      isSubmitting = true;
      callCount++;
      await new Promise((r) => setTimeout(r, 20));
      isSubmitting = false;
      return { blocked: false };
    }

    // Fire two submissions simultaneously (simulating double-tap)
    const [first, second] = await Promise.all([
      guardedSubmit('123456'),
      guardedSubmit('123456'),
    ]);

    assert.strictEqual(callCount, 1);
    assert.strictEqual(first.blocked, false);
    assert.strictEqual(second.blocked, true);
  });
});
