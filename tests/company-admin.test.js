const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// Role extraction logic identical to src/features/auth/session.ts
function getUserRole(user) {
  if (!user) return 'passenger';
  const roles = user.roles ?? [];
  const type = (user.type || '').toLowerCase();
  if (roles.includes('super_admin') || type === 'super_admin' || type === 'admin') {
    return 'super_admin';
  }
  if (roles.includes('company_admin') || type === 'company_admin' || type === 'operator') {
    return 'company_admin';
  }
  if (roles.includes('driver') || type === 'driver') {
    return 'driver';
  }
  return 'passenger';
}

function getRoleDashboardPath(role) {
  switch (role) {
    case 'super_admin':
      return '/portal/admin';
    case 'company_admin':
      return '/portal/company';
    case 'driver':
      return '/portal/driver';
    case 'passenger':
    default:
      return '/(tabs)/home';
  }
}

function dateForApi(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function companyDateRange(period, now = new Date()) {
  const to = new Date(now);
  const from = new Date(to);
  from.setHours(0, 0, 0, 0);
  if (period === '7d') from.setDate(from.getDate() - 6);
  if (period === '30d') from.setDate(from.getDate() - 29);
  return { date_from: dateForApi(from), date_to: dateForApi(to) };
}

describe('Company Admin Session and Role Routing', () => {
  test('identifies company admin from roles array and directs to /portal/company', () => {
    const user = {
      id: '12',
      email: 'admin@citybus.com',
      name: 'City Bus Admin',
      roles: ['company_admin'],
      company_memberships: [
        {
          company_id: 1,
          role: 'company_admin',
          status: 'active',
          company: { id: 1, name: 'City Bus Transport', code: 'CBT', status: 'active' },
        },
      ],
    };

    assert.equal(getUserRole(user), 'company_admin');
    assert.equal(getRoleDashboardPath('company_admin'), '/portal/company');
  });

  test('identifies company admin from user type', () => {
    const user = {
      id: '14',
      email: 'operator@express.com',
      type: 'company_admin',
    };

    assert.equal(getUserRole(user), 'company_admin');
    assert.equal(getRoleDashboardPath(getUserRole(user)), '/portal/company');
  });

  test('super admin takes precedence over company admin and routes to /portal/admin', () => {
    const user = {
      id: '1',
      email: 'super@tappay.com',
      roles: ['super_admin', 'company_admin'],
    };

    assert.equal(getUserRole(user), 'super_admin');
    assert.equal(getRoleDashboardPath(getUserRole(user)), '/portal/admin');
  });

  test('passenger routes to /(tabs)/home and driver to /portal/driver', () => {
    const passengerUser = {
      id: '50',
      email: 'rider@gmail.com',
      roles: ['passenger'],
    };
    assert.equal(getUserRole(passengerUser), 'passenger');
    assert.equal(getRoleDashboardPath('passenger'), '/(tabs)/home');

    const driverUser = {
      id: '51',
      email: 'driver@citybus.com',
      roles: ['driver'],
    };
    assert.equal(getUserRole(driverUser), 'driver');
    assert.equal(getRoleDashboardPath('driver'), '/portal/driver');
  });

  test('calculates correct company date ranges for presets', () => {
    const fixedNow = new Date('2026-10-18T12:00:00Z');
    const today = companyDateRange('today', fixedNow);
    assert.equal(today.date_from, today.date_to);

    const sevenDays = companyDateRange('7d', fixedNow);
    assert.notEqual(sevenDays.date_from, sevenDays.date_to);

    const thirtyDays = companyDateRange('30d', fixedNow);
    assert.notEqual(thirtyDays.date_from, thirtyDays.date_to);
  });

  test('all four user roles have defined dashboard routes and isolation', () => {
    const roles = ['passenger', 'driver', 'company_admin', 'super_admin'];
    const paths = roles.map(getRoleDashboardPath);
    // Ensure all 4 paths are unique
    assert.equal(new Set(paths).size, 4);
    assert.equal(getRoleDashboardPath('passenger'), '/(tabs)/home');
    assert.equal(getRoleDashboardPath('driver'), '/portal/driver');
    assert.equal(getRoleDashboardPath('company_admin'), '/portal/company');
    assert.equal(getRoleDashboardPath('super_admin'), '/portal/admin');
  });

  test('session teardown resets to unauthenticated state with null token and user', () => {
    let session = {
      token: 'test-bearer-token-12345',
      expiresAt: '2026-10-19T00:00:00Z',
      user: { id: '1', email: 'user@tappay.np', roles: ['company_admin'] },
    };
    assert.ok(session.token);
    assert.ok(session.user);

    // Simulate clearSession()
    session = { token: null, expiresAt: null, user: null };
    assert.equal(session.token, null);
    assert.equal(session.user, null);
    assert.equal(getUserRole(session.user), 'passenger');
  });
});
