"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Video, Copy } from "lucide-react";
import { zoomTimeInJapan } from "@/lib/zoom-time";
import { useAuth } from "./auth-gate";
import { type Meeting } from "@/lib/store";
import {
  zoomMeetingSchema,
  zoomRequestSchema,
  type ZoomRequest,
} from "@/lib/zoom-schema";
export default function ZoomCreate({
  onSaved,
  onManual,
  onEditingChange,
}: {
  onSaved: () => Promise<void>;
  onManual: (meeting: Meeting) => void;
  onEditingChange: (editing: boolean) => void;
}) {
  const { client } = useAuth();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [meeting, setMeeting] = useState<Meeting | null>(null),
    [unknown, setUnknown] = useState(false),
    [manual, setManual] = useState(false),
    [stored, setStored] = useState(false);
  const request = useRef<ZoomRequest | null>(null),
    running = useRef(false);
  useEffect(() => {
    onEditingChange(open);
    return () => onEditingChange(false);
  }, [open, onEditingChange]);
  async function perform(input: ZoomRequest) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMessage("Zoom会議を作成しています…");
    try {
      const session = await client.auth.getSession();
      if (session.error || !session.data.session) {
        setMessage("ログインし直してから作成してください。");
        return;
      }
      const response = await fetch("/api/zoom/meetings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.data.session.access_token,
        },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok) {
        setUnknown(result.code === "unknown_result");
        setMessage(
          typeof result.error === "string"
            ? result.error
            : "会議を作成できませんでした。",
        );
        return;
      }
      const valid = zoomMeetingSchema.safeParse(result.meeting);
      if (!valid.success) {
        setUnknown(true);
        setMessage(
          "発行結果を確認できません。Zoomアプリの会議一覧をご確認ください。",
        );
        return;
      }
      setStored(!!result.saved);
      setMeeting(valid.data);
      setManual(!!result.manualSave);
      setUnknown(false);
      if (result.saved) {
        await onSaved();
        setMessage(
          typeof result.warning === "string"
            ? result.warning
            : "Zoom会議を作成し、クラウドに保存しました。",
        );
      } else
        setMessage(
          typeof result.error === "string"
            ? result.error
            : "会議は作成済みです。クラウド保存を再試行してください。",
        );
    } catch {
      setUnknown(true);
      setMessage(
        "通信が中断され、発行結果を確認できません。同じリクエストを確認するか、Zoomアプリの会議一覧をご確認ください。",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const payload = {
      requestId: request.current?.requestId || crypto.randomUUID(),
      title: values.get("title"),
      date: values.get("date"),
      time: values.get("time"),
      duration: Number(values.get("duration")),
      timezone: values.get("timezone"),
      memo: values.get("memo"),
    };
    const parsed = zoomRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setMessage("入力内容を確認してください。");
      return;
    }
    request.current = parsed.data;
    await perform(parsed.data);
  }
  if (!open)
    return (
      <button
        className="primary"
        onClick={() => {
          request.current = null;
          setMessage("");
          setMeeting(null);
          setUnknown(false);
          setManual(false);
          setStored(false);
          setOpen(true);
        }}
      >
        <Plus size={16} />
        Zoom会議を作成
      </button>
    );
  return (
    <section className="panel zoom-create-panel">
      <div className="section-title">
        <h2>
          <Video size={18} />
          Zoom会議を作成
        </h2>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => {
            if (
              unknown &&
              !confirm(
                "発行結果が未確認です。閉じる前にZoomアプリの会議一覧を確認してください。閉じますか？",
              )
            )
              return;
            setOpen(false);
          }}
        >
          閉じる
        </button>
      </div>
      <form onSubmit={submit}>
        <fieldset
          disabled={busy || !!meeting || unknown}
          className="form-fields"
        >
          <label>
            会議のタイトル
            <input
              name="title"
              required
              maxLength={200}
              placeholder="お客様との商談"
            />
          </label>
          <div className="zoom-form-row">
            <label>
              日付
              <input
                type="date"
                name="date"
                required
                defaultValue={zoomTimeInJapan(new Date().toISOString()).date}
              />
            </label>
            <label>
              開始時刻
              <input type="time" name="time" required defaultValue="10:00" />
            </label>
          </div>
          <div className="zoom-form-row">
            <label>
              所要時間（分）
              <input
                type="number"
                name="duration"
                required
                min={15}
                max={480}
                step={1}
                defaultValue={60}
              />
            </label>
            <label>
              時間帯
              <input
                name="timezone"
                required
                value="Asia/Tokyo"
                readOnly
                aria-label="時間帯（日本時間）"
              />
            </label>
          </div>
          <p className="helper">
            日時は日本時間（JST）で入力してください。Zoomにも同じ日時で登録します。
          </p>
          <label>
            メモ
            <textarea name="memo" maxLength={5000} />
          </label>
          <button type="submit" className="primary">
            {busy ? "処理中…" : "作成してリンクを発行"}
          </button>
        </fieldset>
      </form>
      {message && (
        <p role="status" className="zoom-message">
          {message}
        </p>
      )}
      {meeting && (
        <div className="zoom-result">
          <div className="meeting-url">{meeting.url}</div>
          <button
            className="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(meeting.url);
                setMessage("リンクをコピーしました。");
              } catch {
                setMessage("表示中のURLを選択してコピーしてください。");
              }
            }}
          >
            <Copy size={15} />
            発行したリンクをコピー
          </button>
          {manual && (
            <button
              className="secondary"
              onClick={() => {
                onManual(meeting);
                setOpen(false);
              }}
            >
              リンクを手動登録
            </button>
          )}
        </div>
      )}
      {(unknown || (meeting && !manual && !stored)) && request.current && (
        <button
          className="secondary zoom-retry"
          disabled={busy}
          onClick={() => void perform(request.current!)}
        >
          {meeting ? "クラウド保存を再試行" : "同じリクエストの結果を確認"}
        </button>
      )}
      <p className="helper">
        発行後の会議日時の変更・中止はZoomアプリで行ってください。リンクの登録情報はこのアプリで編集できます。
      </p>
    </section>
  );
}
