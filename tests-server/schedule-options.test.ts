import { test } from "node:test";
import assert from "node:assert/strict";
import { initialData, parseData, scheduleEvents } from "../lib/store.ts";

test("旧予定はそのまま読め、色・外部リンクを保存し危険なURLは拒否する", () => {
  const event = { id: "22222222-2222-4222-8222-222222222222", date: "2026-10-16", time: "10:00", title: "商談", type: "商談" };
  assert.equal(parseData({ ...initialData, events: [event] }).events[0].color, undefined);
  const extended = { ...event, color: "green", url: "https://zoom.us/j/123" };
  assert.deepEqual(parseData({ ...initialData, events: [extended] }).events[0], extended);
  for (const url of ["javascript:alert(1)", "http://example.com", "invalid"]) {
    assert.throws(() => parseData({ ...initialData, events: [{ ...extended, url }] }));
  }
  const meetings = [{ ...event, url: extended.url, memo: "" }];
  assert.equal(scheduleEvents({ ...initialData, meetings })[0].color, "blue");
  assert.equal(scheduleEvents({ ...initialData, meetings: [{ ...meetings[0], color: "purple" }] })[0].color, "purple");
});
