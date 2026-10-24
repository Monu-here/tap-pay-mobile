type ConfirmedTransitFare = {
  status: 'valid';
  travel_uid: string;
};

export function isConfirmedTransitFare(ticket: unknown): ticket is ConfirmedTransitFare;
