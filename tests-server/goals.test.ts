import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialData,
  monthlyGoal,
  parseData,
  mergeLegacy,
} from "../lib/store.ts";
test("年間5,000万円を12で割り、1円未満を切り上げる", () => {
  assert.deepEqual(monthlyGoal(initialData, "2026-10"), {
    mode: "auto",
    amount: 4166667,
  });
  assert.equal(
    monthlyGoal({ ...initialData, annual: 60000000 }, "2026-10").amount,
    5000000,
  );
});
test("月ごとに手動と自動を維持し、年間目標変更は自動だけに反映する", () => {
  const data = parseData({
    ...initialData,
    monthlyGoals: {
      "2026-10": { mode: "manual", amount: 5500000 },
      "2026-11": { mode: "auto" },
    },
  });
  const changed = { ...data, annual: 72000000 };
  assert.equal(monthlyGoal(changed, "2026-10").amount, 5500000);
  assert.equal(monthlyGoal(changed, "2026-11").amount, 6000000);
  assert.equal(monthlyGoal(changed, "2027-10").amount, 6000000);
});
test("旧データの共通月間目標は自動で変更しない", () => {
  const { monthlyGoalMode, ...legacy } = structuredClone(initialData);
  void monthlyGoalMode;
  assert.deepEqual(monthlyGoal(parseData(legacy), "2026-10"), {
    mode: "manual",
    amount: 4200000,
  });
  const data = parseData({
    ...legacy,
    monthlyGoals: { "2026-10": { mode: "auto" } },
  });
  assert.equal(monthlyGoal(data, "2026-10").amount, 4166667);
  assert.equal(monthlyGoal(data, "2026-11").amount, 4200000);
});
test("旧データ移行で既存クラウドの月別設定を消さず、新規移行は旧目標を引き継ぐ", () => {
  const cloud = parseData({
    ...initialData,
    monthlyGoals: { "2026-10": { mode: "manual", amount: 6000000 } },
  });
  const { monthlyGoalMode, ...old } = structuredClone(initialData);
  void monthlyGoalMode;
  assert.deepEqual(
    mergeLegacy(cloud, parseData(old), false).monthlyGoals,
    cloud.monthlyGoals,
  );
  assert.equal(
    monthlyGoal(mergeLegacy(initialData, parseData(old), true), "2026-10")
      .amount,
    4200000,
  );
});
test("不正な月・手動金額を保存できない", () => {
  assert.throws(() =>
    parseData({
      ...initialData,
      monthlyGoals: { "2026-13": { mode: "auto" } },
    }),
  );
  assert.throws(() =>
    parseData({
      ...initialData,
      monthlyGoals: { "2026-10": { mode: "manual", amount: 0 } },
    }),
  );
});
