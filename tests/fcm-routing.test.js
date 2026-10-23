const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// Replicate fcmDestination pure logic for node unit test
function fcmDestination(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const eventType = typeof payload.eventType === 'string' ? payload.eventType : '';
  const resourceType = typeof payload.resourceType === 'string' ? payload.resourceType : '';
  const resourceReference = typeof payload.resourceReference === 'string' ? payload.resourceReference : '';

  if (resourceType === 'wallet_transaction' && resourceReference) {
    return `/wallet/transaction/${encodeURIComponent(resourceReference)}`;
  }
  if (resourceType === 'card') return '/(tabs)/cards';
  if (resourceType === 'trip') return '/travel';
  if (resourceType === 'payment') return '/(tabs)/wallet';
  if (resourceType === 'company') {
    return eventType === 'company_approval_required' ? '/portal/admin' : '/portal/company';
  }
  if (eventType.startsWith('driver_assignment') || eventType.startsWith('driver_')) {
    return '/portal/driver';
  }
  return '/notifications';
}

describe('FCM notification tap routing and destinations', () => {
  test('routes wallet transactions to transaction detail screen', () => {
    const dest = fcmDestination({
      resourceType: 'wallet_transaction',
      resourceReference: 'TX-987654',
      eventType: 'wallet_topup_successful',
    });
    assert.equal(dest, '/wallet/transaction/TX-987654');
  });

  test('routes card updates to cards tab', () => {
    const dest = fcmDestination({
      resourceType: 'card',
      eventType: 'card_blocked',
    });
    assert.equal(dest, '/(tabs)/cards');
  });

  test('routes trip updates to travel screen', () => {
    const dest = fcmDestination({
      resourceType: 'trip',
      eventType: 'trip_completed',
    });
    assert.equal(dest, '/travel');
  });

  test('routes driver assignment and operational events to driver portal', () => {
    const dest1 = fcmDestination({ eventType: 'driver_assignment_created' });
    const dest2 = fcmDestination({ eventType: 'driver_account_updated' });
    assert.equal(dest1, '/portal/driver');
    assert.equal(dest2, '/portal/driver');
  });

  test('routes company approval events to admin portal and other company events to company portal', () => {
    const adminDest = fcmDestination({
      resourceType: 'company',
      eventType: 'company_approval_required',
    });
    const companyDest = fcmDestination({
      resourceType: 'company',
      eventType: 'company_profile_updated',
    });
    assert.equal(adminDest, '/portal/admin');
    assert.equal(companyDest, '/portal/company');
  });

  test('falls back safely to notifications screen on empty or unknown payloads', () => {
    assert.equal(fcmDestination({}), '/notifications');
    assert.equal(fcmDestination(null), '/notifications');
    assert.equal(fcmDestination({ unknown: 'data' }), '/notifications');
  });
});
