const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { isConfirmedTransitFare } = require('../src/features/passenger/services/transitFeedback');

describe('transit feedback eligibility', () => {
  test('accepts a backend-confirmed fare ticket with a travel identifier', () => {
    assert.equal(isConfirmedTransitFare({ status: 'valid', travel_uid: '01JABCDEF01234567890123456' }), true);
  });

  test('rejects missing, failed, pending, or incomplete ticket responses', () => {
    for (const ticket of [
      null,
      undefined,
      { status: 'failed', travel_uid: '01JABCDEF01234567890123456' },
      { status: 'pending', travel_uid: '01JABCDEF01234567890123456' },
      { status: 'valid' },
      { status: 'valid', travel_uid: '' },
    ]) {
      assert.equal(isConfirmedTransitFare(ticket), false);
    }
  });
});
