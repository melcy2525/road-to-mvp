import { z } from "zod";
export const eventColors = ["gold", "blue", "green", "purple", "rose"] as const;
export type EventColor = (typeof eventColors)[number];
export type Event = {
  color?: EventColor;
  url?: string;
  id: string;
  date: string;
  time: string;
  title: string;
  type: string;
};
export type Meeting = {
  color?: EventColor;
  startsAt?: string;
  duration?: number;
  timezone?: string;
  id: string;
  date: string;
  time: string;
  title: string;
  url: string;
  memo: string;
};
export type Report = {
  id: string;
  date: string;
  result: string;
  reflection: string;
  cause: string;
  action: string;
};
export type Review = {
  id: string;
  month: string;
  result: string;
  reflection: string;
  action: string;
};
export type Sale = { id: string; date: string; title: string; amount: number };
export type MonthlyGoal = { mode: "auto" } | { mode: "manual"; amount: number };
export type Memo = { id: string; title: string; body: string; updatedAt: string };
export type Data = {
  notes?: Memo[];
  monthlyGoalMode?: "auto" | "manual";
  monthlyGoals?: Record<string, MonthlyGoal>;
  annual: number;
  monthly: number;
  events: Event[];
  meetings: Meeting[];
  reports: Report[];
  reviews: Review[];
  sales: Sale[];
};
export const initialData: Data = {
  notes: [],
  annual: 50000000,
  monthly: 4200000,
  monthlyGoalMode: "auto",
  events: [],
  meetings: [],
  reports: [],
  reviews: [],
  sales: [],
};
export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const yen = (n: number) =>
  new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(n);

const text = z.string().max(5000);
const id = z.string().uuid();
const date = z.iso.date();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const money = z.number().int().nonnegative().max(999999999999);
const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const dataSchema = z.object({
  notes: z.array(z.object({
    id, title: z.string().max(200), body: z.string().trim().min(1).max(20000),
    updatedAt: z.iso.datetime({ offset: true }),
  })).max(10000).optional(),
  monthlyGoalMode: z.enum(["auto", "manual"]).optional(),
  monthlyGoals: z
    .record(
      monthKey,
      z.discriminatedUnion("mode", [
        z.object({ mode: z.literal("auto") }),
        z.object({ mode: z.literal("manual"), amount: money.positive() }),
      ]),
    )
    .optional(),
  annual: money.positive(),
  monthly: money.positive(),
  events: z
    .array(z.object({ id, date, time, title: text, type: text, color: z.enum(eventColors).optional(), url: z.url().startsWith("https://").max(2048).optional() }))
    .max(10000),
  meetings: z
    .array(
      z.object({
        id,
        date,
        time,
        title: text,
        url: z.url().startsWith("https://").max(2048),
        duration: z.number().int().positive().optional(),
        timezone: z.string().optional(),
        color: z.enum(eventColors).optional(),
        startsAt: z.iso.datetime({ offset: true }).optional(),
        memo: text,
      }),
    )
    .max(10000),
  reports: z
    .array(
      z.object({
        id,
        date,
        result: text,
        reflection: text,
        cause: text,
        action: text,
      }),
    )
    .max(10000),
  reviews: z
    .array(
      z.object({
        id,
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
        result: text,
        reflection: text,
        action: text,
      }),
    )
    .max(10000),
  sales: z
    .array(z.object({ id, date, title: text, amount: money.positive() }))
    .max(10000),
});
export function parseData(raw: unknown): Data {
  return dataSchema.parse(raw);
}
// Cloud records win on matching IDs (and on report dates / review months).
// Re-importing the same source is idempotent, including sales totals.
export function mergeLegacy(
  cloud: Data,
  legacy: Data,
  pristine: boolean,
): Data {
  const merge = <T extends { id: string }>(
    current: T[],
    incoming: T[],
    key: (item: T) => string,
  ) => {
    const ids = new Set(current.map((item) => item.id));
    const keys = new Set(current.map(key));
    return [
      ...current,
      ...incoming.filter((item) => {
        if (ids.has(item.id) || keys.has(key(item))) return false;
        ids.add(item.id);
        keys.add(key(item));
        return true;
      }),
    ];
  };
  return parseData({
    annual: pristine ? legacy.annual : cloud.annual,
    monthly: pristine ? legacy.monthly : cloud.monthly,
    monthlyGoalMode: pristine
      ? (legacy.monthlyGoalMode ?? "manual")
      : cloud.monthlyGoalMode,
    monthlyGoals: pristine ? legacy.monthlyGoals : cloud.monthlyGoals,
    notes: merge(cloud.notes ?? [], legacy.notes ?? [], (x) => x.id),
    events: merge(cloud.events, legacy.events, (x) => x.id),
    meetings: merge(cloud.meetings, legacy.meetings, (x) => x.id),
    reports: merge(cloud.reports, legacy.reports, (x) => x.date),
    reviews: merge(cloud.reviews, legacy.reviews, (x) => x.month),
    sales: merge(cloud.sales, legacy.sales, (x) => x.id),
  });
}

export type ScheduleEvent = Event & { meetingId?: string };
// A single source of truth: no duplicated calendar records to become stale.
export function scheduleEvents(data: Data): ScheduleEvent[] {
  return [
    ...data.events,
    ...data.meetings.map((meeting) => ({
      id: "zoom-" + meeting.id,
      meetingId: meeting.id,
      color: meeting.color ?? "blue",
      url: meeting.url,
      date: meeting.date,
      time: meeting.time,
      title: meeting.title,
      type: "Zoom",
    })),
  ];
}

// Legacy documents keep their previously entered common monthly amount.
export function monthlyGoal(
  data: Data,
  month: string,
): { mode: "auto" | "manual"; amount: number } {
  const setting = data.monthlyGoals?.[month];
  const mode = setting?.mode ?? data.monthlyGoalMode ?? "manual";
  return {
    mode,
    amount:
      mode === "auto"
        ? Math.ceil(data.annual / 12)
        : setting?.mode === "manual"
          ? setting.amount
          : data.monthly,
  };
}
