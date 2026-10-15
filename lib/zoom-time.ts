import { z } from "zod";
export const JAPAN_TIMEZONE = "Asia/Tokyo";
// UTC is used for comparisons and reading Zoom responses, not the create payload.
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

// Use one Zoom API representation: local wall time + its explicit timezone.
// Never send an already shifted UTC wall time with a named local timezone.
export function zoomStartInJapan(date: string, time: string) {
  return { start_time: `${date}T${time}:00`, timezone: JAPAN_TIMEZONE };
}
