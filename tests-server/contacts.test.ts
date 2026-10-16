import { test } from "node:test";
import assert from "node:assert/strict";
import { initialData, mergeLegacy, parseData } from "../lib/store.ts";

test("旧データ移行で出会いを保持し、再移行で重複しない。同姓同名の出会いも残す", () => {
  const person = { id: "22222222-2222-4222-8222-222222222222", date: "2026-10-16", name: "山田", place: "", occupation: "", memo: "" };
  const cloud = { ...initialData, contacts: [person] };
  const legacy = { ...initialData, contacts: undefined };
  assert.equal(parseData(legacy).contacts, undefined);
  assert.deepEqual(mergeLegacy(cloud, legacy, false).contacts, [person]);
  assert.deepEqual(mergeLegacy(cloud, cloud, false).contacts, [person]);
  const second = { ...person, id: "33333333-3333-4333-8333-333333333333" };
  assert.equal(mergeLegacy(cloud, { ...legacy, contacts: [second] }, false).contacts?.length, 2);
  assert.throws(() => parseData({ ...cloud, contacts: [{ ...person, name: " " }] }));
  assert.throws(() => parseData({ ...cloud, contacts: [{ ...person, date: "2026-02-30" }] }));
});
