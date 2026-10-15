import { test } from "node:test";
import assert from "node:assert/strict";
import {
  japanTimeToUtc,
  zoomTimeInJapan,
  zoomStartInJapan,
} from "../lib/zoom-time.ts";
test("日本時間からUTCへの変換は年・月・日をまたいでも9時間差を保持する", () => {
  assert.equal(
    japanTimeToUtc("2027-01-01", "00:15"),
    "2026-12-31T15:15:00.000Z",
  );
  assert.equal(
    japanTimeToUtc("2026-12-01", "10:00"),
    "2026-12-01T01:00:00.000Z",
  );
  assert.equal(
    japanTimeToUtc("2026-12-01", "23:45"),
    "2026-12-01T14:45:00.000Z",
  );
});
test("ZoomのUTC・明示offsetを日本時間へ表示する", () => {
  assert.deepEqual(zoomTimeInJapan("2026-12-31T15:15:00Z"), {
    date: "2027-01-01",
    time: "00:15",
    timezone: "Asia/Tokyo",
    startsAt: "2026-12-31T15:15:00.000Z",
  });
  assert.equal(zoomTimeInJapan("2026-12-01T10:00:00+09:00").time, "10:00");
  assert.equal(zoomTimeInJapan("2026-11-30T16:00:00-08:00").time, "09:00");
});
test("時間帯不明のZoom日時は受け入れない", () => {
  assert.throws(() => zoomTimeInJapan("2026-12-01T10:00:00"));
});

test("Zoom作成リクエストは10時を1時へ書き換えず、日本時間を明示する", () => {
  assert.deepEqual(zoomStartInJapan("2026-12-01", "10:00"), {
    start_time: "2026-12-01T10:00:00",
    timezone: "Asia/Tokyo",
  });
  assert.deepEqual(zoomStartInJapan("2027-01-01", "00:15"), {
    start_time: "2027-01-01T00:15:00",
    timezone: "Asia/Tokyo",
  });
  const payload = zoomStartInJapan("2026-12-01", "10:00");
  assert.equal(
    zoomTimeInJapan(new Date(payload.start_time + "+09:00").toISOString()).time,
    "10:00",
  );
});
