export const ALERT_HORIZONS_DAYS = [180, 90, 30, 7] as const;

export type AlertHorizonDays = (typeof ALERT_HORIZONS_DAYS)[number];

export const ALERT_EVENT_KINDS = ["expiry", "break", "rent_review"] as const;

export type AlertEventKind = (typeof ALERT_EVENT_KINDS)[number];

export function isAlertEventKind(value: string): value is AlertEventKind {
  return (ALERT_EVENT_KINDS as readonly string[]).includes(value);
}

export function isAlertHorizonDays(value: number): value is AlertHorizonDays {
  return (ALERT_HORIZONS_DAYS as readonly number[]).includes(value);
}
