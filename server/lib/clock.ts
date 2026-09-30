/**
 * Dev-only clock offset.  The frontend has a clock-advance tool so the backend mirrors it.
 * A single module keeps the offset so the ledger always uses one time source: clockNow().
 *
 * Endpoint: POST /dev/clock  { offsetDays: number }  (platform app only)
 * Reset:    POST /dev/reset  clears offset
 *
 * Never import Date.now() or new Date() outside this module in any business-rule code.
 * Pass clockNow() into every method that needs the current time.
 */

let offsetMs = 0;

export function clockNow(): Date {
  return new Date(Date.now() + offsetMs);
}

export function setClockOffset(days: number): void {
  offsetMs = days * 864e5;
}

export function getClockOffsetDays(): number {
  return offsetMs / 864e5;
}

export function resetClock(): void {
  offsetMs = 0;
}
