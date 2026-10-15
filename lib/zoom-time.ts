import { z } from "zod";
export const JAPAN_TIMEZONE = "Asia/Tokyo";
// Always include the UTC offset: Zoom must not reinterpret a local wall time.
export function japanTimeToUtc(date: string, time: string) {
  return new Date(`${date}T${time}:00+09:00`).toISOString();
}
export function zoomTimeInJapan(raw: unknown) {
  const start = z.iso.datetime({ offset: true }).parse(raw);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: JAPAN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(start));
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
    timezone: JAPAN_TIMEZONE,
    startsAt: new Date(start).toISOString(),
  };
}
