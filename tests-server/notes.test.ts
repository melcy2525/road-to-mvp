import { test } from "node:test";
import assert from "node:assert/strict";
import { initialData, mergeLegacy, parseData } from "../lib/store.ts";

test("旧データ移行でクラウドメモを保持し、再取り込みは重複しない", () => {
  const note = { id: "22222222-2222-4222-8222-222222222222", title: "意識すること", body: "まず聞く", updatedAt: "2026-10-16T10:00:00Z" };
  const cloud = { ...initialData, notes: [note] };
  const legacy = { ...initialData, notes: undefined };
  assert.deepEqual(mergeLegacy(cloud, legacy, false).notes, [note]);
  assert.deepEqual(mergeLegacy(cloud, cloud, false).notes, [note]);
  assert.equal(parseData(legacy).notes, undefined);
  assert.throws(() => parseData({ ...cloud, notes: [{ ...note, body: "   " }] }));
});
