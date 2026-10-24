function isConfirmedTransitFare(ticket) {
  return Boolean(
    ticket
      && typeof ticket === 'object'
      && ticket.status === 'valid'
      && typeof ticket.travel_uid === 'string'
      && ticket.travel_uid.length > 0,
  );
}

module.exports = { isConfirmedTransitFare };
