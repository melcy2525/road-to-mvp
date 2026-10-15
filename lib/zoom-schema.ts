import { z } from "zod";
export const zoomRequestSchema = z.object({
  requestId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  date: z.iso.date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  duration: z.number().int().min(15).max(480),
  timezone: z.literal("Asia/Tokyo"),
  memo: z.string().max(5000).default(""),
});
export type ZoomRequest = z.infer<typeof zoomRequestSchema>;
export const zoomMeetingSchema = z.object({
  id: z.string().uuid(),
  date: z.iso.date(),
  time: z.string(),
  title: z.string(),
  url: z.url().startsWith("https://"),
  memo: z.string(),
  duration: z.number().int().positive().optional(),
  timezone: z.string().optional(),
  startsAt: z.iso.datetime({ offset: true }).optional(),
});
