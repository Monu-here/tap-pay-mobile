const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  isFailedPaymentStatus,
  isSuccessfulPaymentStatus,
} = require('../src/features/passenger/services/paymentStatus');

describe('payment status confirmation', () => {
  test('recognizes only server-confirmed successful states', () => {
    for (const status of ['completed', 'paid', 'success', 'succeeded', 'successful']) {
      assert.equal(isSuccessfulPaymentStatus(status), true);
    }
    for (const status of ['created', 'initiated', 'pending', 'processing', 'failed']) {
      assert.equal(isSuccessfulPaymentStatus(status), false);
    }
  });

  test('recognizes terminal unsuccessful states separately', () => {
    for (const status of ['cancelled', 'canceled', 'expired', 'failed', 'rejected']) {
      assert.equal(isFailedPaymentStatus(status), true);
    }
    assert.equal(isFailedPaymentStatus('pending'), false);
  });

  test('handles status casing and malformed values safely', () => {
    assert.equal(isSuccessfulPaymentStatus('COMPLETED'), true);
    assert.equal(isSuccessfulPaymentStatus(undefined), false);
    assert.equal(isFailedPaymentStatus(null), false);
  });
});
