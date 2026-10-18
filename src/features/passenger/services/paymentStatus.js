const successfulStatuses = new Set(['completed', 'paid', 'success', 'succeeded']);
const failedStatuses = new Set(['cancelled', 'canceled', 'expired', 'failed', 'rejected']);

function isSuccessfulPaymentStatus(status) {
  return typeof status === 'string' && successfulStatuses.has(status.toLowerCase());
}

function isFailedPaymentStatus(status) {
  return typeof status === 'string' && failedStatuses.has(status.toLowerCase());
}

module.exports = { isFailedPaymentStatus, isSuccessfulPaymentStatus };
