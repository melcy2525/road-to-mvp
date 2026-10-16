"use client";
import { useState } from "react";
import { monthlyGoal, yen, type Data } from "@/lib/store";
export default function GoalFields({
  data,
  month,
}: {
  data: Data;
  month: string;
}) {
  const initial = monthlyGoal(data, month);
  const [annual, setAnnual] = useState(String(data.annual)),
    [selectedMonth, setMonth] = useState(month),
    [mode, setMode] = useState(initial.mode),
    [amount, setAmount] = useState(String(initial.amount));
  const calculated = Math.ceil((Number(annual) || 0) / 12);
  return (
    <>
      <label>
        年間売上目標（円）
        <input
          name="annual"
          type="number"
          min={1}
          max={999999999999}
          step={1}
          required
          value={annual}
          onChange={(e) => setAnnual(e.target.value)}
        />
      </label>
      <label>
        目標を設定する月
        <input
          name="goalMonth"
          type="month"
          required
          value={selectedMonth}
          onChange={(e) => {
            const value = e.target.value;
            setMonth(value);
            const goal = monthlyGoal(data, value);
            setMode(goal.mode);
            setAmount(String(goal.amount));
          }}
        />
      </label>
      <fieldset className="goal-mode">
        <legend>この月の目標の決め方</legend>
        <label
          className={mode === "auto" ? "goal-choice chosen" : "goal-choice"}
        >
          <input
            type="radio"
            name="monthlyMode"
            value="auto"
            checked={mode === "auto"}
            onChange={() => setMode("auto")}
          />
          <span>
            <strong>自動で計算</strong>
            <small>年間目標 ÷ 12か月</small>
          </span>
        </label>
        <label
          className={mode === "manual" ? "goal-choice chosen" : "goal-choice"}
        >
          <input
            type="radio"
            name="monthlyMode"
            value="manual"
            checked={mode === "manual"}
            onChange={() => setMode("manual")}
          />
          <span>
            <strong>手動で指定</strong>
            <small>この月だけ金額を自由に設定</small>
          </span>
        </label>
      </fieldset>
      <label>
        月間売上目標（円）
        <input
          name="monthly"
          type="number"
          min={1}
          max={999999999999}
          step={1}
          required
          disabled={mode === "auto"}
          value={mode === "auto" ? calculated : amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <div className="goal-preview">
        <span>{selectedMonth.replace("-", "年")}月の売上目標</span>
        <output aria-label="月間目標のプレビュー">
          {yen(mode === "auto" ? calculated : Number(amount) || 0)}
        </output>
        <p>
          {mode === "auto"
            ? "年間目標に合わせて自動更新します。1円未満は切り上げます。"
            : "この月の手動目標は、年間目標を変更しても維持します。"}
        </p>
      </div>
      <p className="helper">
        自動・手動は月ごとに切り替えできます。既に設定されている別の月の目標は変更しません。
      </p>
    </>
  );
}
