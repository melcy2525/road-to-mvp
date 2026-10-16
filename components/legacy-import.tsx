"use client";
import { useState } from "react";
import { parseData, type Data } from "@/lib/store";
export default function LegacyImport({
  onImport,
  disabled,
}: {
  onImport: (data: Data) => Promise<boolean>;
  disabled: boolean;
}) {
  const [candidate, setCandidate] = useState<Data | null>(null),
    [message, setMessage] = useState("");
  function read(raw: string | null) {
    try {
      if (!raw) {
        setMessage(
          "このブラウザに旧データはありません。旧サイトで書き出したJSONを読み込むこともできます。",
        );
        return;
      }
      setCandidate(parseData(JSON.parse(raw)));
      setMessage("内容を確認してから「クラウドへ移行」を押してください。");
    } catch {
      setCandidate(null);
      setMessage(
        "データの形式が正しくありません。元データは変更していません。",
      );
    }
  }
  function download() {
    if (!candidate) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(candidate, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "road-to-mvp-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <details className="migration-panel">
      <summary>以前のブラウザデータを移行する</summary>
      <p>
        旧データは自動で読み込み・削除しません。同じブラウザ・同じURLの保存データ、または書き出したJSONを選択してください。
      </p>
      <div className="migration-actions">
        <button
          disabled={disabled}
          className="secondary"
          onClick={() => {
            try {
              read(localStorage.getItem("road-to-mvp:v1"));
            } catch {
              setMessage(
                "ブラウザ保存にアクセスできません。JSONファイルを選択してください。",
              );
            }
          }}
        >
          旧データを確認
        </button>
        <label className="secondary file-label">
          JSONを読み込む
          <input
            type="file"
            accept="application/json,.json"
            disabled={disabled}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 10000000) {
                setMessage("10MB以下のJSONを選択してください。");
                return;
              }
              try {
                read(await f.text());
              } catch {
                setMessage("ファイルを読み込めませんでした。");
              }
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {message && <p role="status">{message}</p>}
      {candidate && (
        <div className="migration-preview">
          <p>
            予定 {candidate.events.length}件 / 日報 {candidate.reports.length}件
            / 売上 {candidate.sales.length}件 / 会議 {candidate.meetings.length}
            件 / 振り返り {candidate.reviews.length}件 / メモ {candidate.notes?.length ?? 0}件 / 出会い {candidate.contacts?.length ?? 0}件
          </p>
          <p>
            一致するID・日報の日付・振り返りの月はクラウド側を優先します。目標はクラウドが初期状態の場合だけ移行します。同じデータを再移行しても売上は二重登録されません。
          </p>
          <p>
            移行先は現在ログイン中のアカウントです。JSONには個人情報が含まれるため保管に注意してください。
          </p>
          <div className="migration-actions">
            <button className="secondary" onClick={download}>
              JSONを書き出す
            </button>
            <button
              className="primary"
              disabled={disabled}
              onClick={async () => {
                if (
                  !confirm(
                    "このデータを現在のアカウントのクラウドへ移行しますか？ 元のブラウザデータは残ります。",
                  )
                )
                  return;
                try {
                  if (await onImport(candidate)) {
                    setCandidate(null);
                    setMessage(
                      "クラウドへ移行しました。元のブラウザデータは削除していません。",
                    );
                  }
                } catch {
                  setMessage(
                    "移行できませんでした。データ形式・件数を確認してください。元データは変更していません。",
                  );
                }
              }}
            >
              クラウドへ移行
            </button>
            <button className="secondary" onClick={() => setCandidate(null)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </details>
  );
}
