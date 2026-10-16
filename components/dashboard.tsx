"use client";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Flag,
  Home,
  Menu,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  Video,
  X,
  Copy,
  Pencil,
  Check,
  TrendingUp,
} from "lucide-react";
import {
  Data,
  dateKey,
  initialData,
  mergeLegacy,
  monthlyGoal,
  scheduleEvents,
  yen,
} from "@/lib/store";
import { useAuth } from "@/components/auth-gate";
import { zoomTimeInJapan } from "@/lib/zoom-time";
import GoalFields from "@/components/goal-fields";
import ZoomCreate from "@/components/zoom-create";
import LegacyImport from "@/components/legacy-import";
import { createRepository } from "@/lib/cloud";
const tabs = [
  "ホーム",
  "スケジュール",
  "Zoom管理",
  "日報",
  "目標管理",
  "月間振り返り",
];
const icons = [Home, CalendarDays, Video, ClipboardList, Target, TrendingUp];
type FormState = { kind: string; values: Record<string, string>; id?: string };
export default function Page() {
  const [data, setData] = useState<Data>(initialData),
    [ready, setReady] = useState(false),
    [tab, setTab] = useState("ホーム"),
    [mobile, setMobile] = useState(false),
    [notice, setNotice] = useState(""),
    [form, setForm] = useState<FormState | null>(null),
    [today, setToday] = useState(""),
    [cursor, setCursor] = useState(""),
    [view, setView] = useState("月"),
    [month, setMonth] = useState(""),
    [loadError, setLoadError] = useState(false);
  const { client, user, logout } = useAuth();
  const repository = useMemo(
    () => createRepository(client, user.id),
    [client, user.id],
  );
  const revision = useRef(0),
    busy = useRef(false),
    editing = useRef(false),
    alive = useRef(true);
  const [saving, setSaving] = useState(false),
    [syncMessage, setSyncMessage] = useState("接続中…"),
    [lastSynced, setLastSynced] = useState("");
  const zoomEditing = useRef(false);
  const onZoomEditing = useCallback((value: boolean) => {
    zoomEditing.current = value;
  }, []);
  editing.current = !!form;
  useEffect(() => {
    const now = zoomTimeInJapan(new Date().toISOString()).date;
    setToday(now);
    setCursor(now);
    setMonth(now.slice(0, 7));
    alive.current = true;
    let active = true;
    const sync = async () => {
      if (!active || busy.current) return;
      busy.current = true;
      try {
        const result = await repository.load();
        if (active) {
          setData(result.data);
          revision.current = result.revision;
          setLoadError(false);
          setReady(true);
          setSyncMessage("クラウド同期済み");
          setLastSynced(new Date().toLocaleTimeString("ja-JP"));
        }
      } catch (e) {
        if (active) {
          setLoadError(true);
          setReady(true);
          setSyncMessage(
            e instanceof Error
              ? e.message
              : "クラウドを読み込めません。再試行してください。",
          );
        }
      } finally {
        busy.current = false;
      }
    };
    queueMicrotask(() => void sync());
    const refresh = () => {
      if (
        !editing.current &&
        !zoomEditing.current &&
        document.visibilityState === "visible"
      )
        void sync();
    };
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      alive.current = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [repository]);
  async function reload() {
    if (busy.current) return;
    busy.current = true;
    setSyncMessage("再読み込み中…");
    try {
      const result = await repository.load();
      if (alive.current) {
        setData(result.data);
        revision.current = result.revision;
        setLoadError(false);
        setReady(true);
        setSyncMessage("クラウド同期済み");
        setLastSynced(new Date().toLocaleTimeString("ja-JP"));
      }
    } catch (e) {
      if (alive.current) {
        setLoadError(true);
        setSyncMessage(
          e instanceof Error ? e.message : "クラウドを読み込めません。",
        );
      }
    } finally {
      busy.current = false;
    }
  }
  async function save(next: Data) {
    if (loadError || !ready) {
      setNotice("クラウドの読み込みが必要です。再読み込みしてください。");
      return false;
    }
    if (busy.current) {
      setNotice("同期・保存処理中です。少し待ってから再試行してください。");
      return false;
    }
    busy.current = true;
    setSaving(true);
    try {
      const result = await repository.save(next, revision.current);
      if (!alive.current) return false;
      setData(result.data);
      revision.current = result.revision;
      setSyncMessage("クラウド同期済み");
      setLastSynced(new Date().toLocaleTimeString("ja-JP"));
      setNotice("クラウドに保存しました");
      return true;
    } catch (e) {
      if (alive.current) {
        const message =
          e instanceof Error ? e.message : "保存できませんでした。";
        setNotice(message);
        setSyncMessage(message);
      }
      return false;
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  }
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!form) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>("button,input,select,textarea") ||
          [],
      );
    focusable()
      .find((el) => el.tagName === "INPUT")
      ?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setForm(null);
      if (e.key === "Tab") {
        const nodes = focusable();
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [form]);
  const year = Number((today || "2026").slice(0, 4));
  const annualSales = data.sales
    .filter((s) => s.date.startsWith(String(year)))
    .reduce((n, s) => n + s.amount, 0);
  const monthlySales = data.sales
    .filter((s) => s.date.startsWith(month))
    .reduce((n, s) => n + s.amount, 0);
  const rate = data.annual > 0 ? (annualSales / data.annual) * 100 : 0;
  const currentGoal = monthlyGoal(data, today.slice(0, 7));
  const selectedGoal = monthlyGoal(data, month);
  const open = (
    kind: string,
    values: Record<string, string> = {},
    id?: string,
  ) =>
    setForm({
      kind,
      values: { date: today, time: "10:00", month, ...values },
      id,
    });
  function remove(
    collection: "events" | "meetings" | "reports" | "reviews" | "sales",
    id: string,
  ) {
    if (confirm("このデータを削除しますか？"))
      save({
        ...data,
        [collection]: data[collection].filter((v) => v.id !== id),
      });
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form) return;
    const v = Object.fromEntries(
      new FormData(e.currentTarget).entries(),
    ) as Record<string, string>;
    const id = form.id || crypto.randomUUID();
    let next = { ...data };
    if (form.kind === "目標") {
      next = {
        ...data,
        annual: Number(v.annual),
        monthlyGoals: {
          ...data.monthlyGoals,
          [v.goalMonth]:
            v.monthlyMode === "auto"
              ? { mode: "auto" }
              : { mode: "manual", amount: Number(v.monthly) },
        },
      };
    }
    if (form.kind === "予定")
      next.events = [
        ...data.events.filter((x) => x.id !== id),
        { id, date: v.date, time: v.time, title: v.title, type: v.type },
      ];
    if (form.kind === "Zoom")
      next.meetings = [
        ...data.meetings.filter((x) => x.id !== id),
        {
          ...data.meetings.find((meeting) => meeting.id === id),
          id,
          date: v.date,
          time: v.time,
          title: v.title,
          url: v.url,
          memo: v.memo,
        },
      ];
    if (form.kind === "売上")
      next.sales = [
        ...data.sales.filter((x) => x.id !== id),
        { id, date: v.date, title: v.title, amount: Number(v.amount) },
      ];
    if (form.kind === "日報")
      next.reports = [
        ...data.reports.filter((x) => x.id !== id && x.date !== v.date),
        {
          id,
          date: v.date,
          result: v.result,
          reflection: v.reflection,
          cause: v.cause,
          action: v.action,
        },
      ];
    if (form.kind === "振り返り")
      next.reviews = [
        ...data.reviews.filter((x) => x.id !== id && x.month !== v.month),
        {
          id,
          month: v.month,
          result: v.result,
          reflection: v.reflection,
          action: v.action,
        },
      ];
    if (await save(next)) {
      if (form.kind === "目標") setMonth(v.goalMonth);
      setForm(null);
    }
  }

  const scheduledEvents = scheduleEvents(data);
  const dayEvents = scheduledEvents
    .filter((e) => e.date === today)
    .sort((a, b) => a.time.localeCompare(b.time));
  const go = (name: string) => {
    setTab(name);
    setMobile(false);
  };
  function shift(direction: number) {
    const d = new Date(cursor + "T12:00:00");
    if (view === "月") {
      d.setDate(1);
      d.setMonth(d.getMonth() + direction);
    } else d.setDate(d.getDate() + direction * (view === "週" ? 7 : 1));
    setCursor(dateKey(d));
  }
  const cursorDate = new Date((cursor || "2026-10-15") + "T12:00:00");
  const gridStart = new Date(cursorDate);
  if (view === "月") {
    gridStart.setDate(1);
    gridStart.setDate(1 - gridStart.getDay());
  } else if (view === "週")
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const days = Array.from(
    { length: view === "月" ? 42 : view === "週" ? 7 : 1 },
    (_, i) => {
      const d = new Date(gridStart);
      d.setDate(d.getDate() + i);
      return d;
    },
  );
  const editButtons = (
    kind: string,
    key: "events" | "meetings" | "reports" | "reviews" | "sales",
    item: { id: string },
  ) => (
    <div className="row-actions">
      <button
        aria-label="編集"
        onClick={() =>
          open(
            kind,
            Object.fromEntries(
              Object.entries(item).map(([k, v]) => [k, String(v)]),
            ),
            item.id,
          )
        }
      >
        <Pencil size={15} />
      </button>
      <button aria-label="削除" onClick={() => remove(key, item.id)}>
        <Trash2 size={15} />
      </button>
    </div>
  );
  if (!ready || loadError)
    return (
      <div className="auth-shell">
        <section className="auth-card">
          <Trophy size={35} />
          <h1>ROAD TO MVP</h1>
          <p role={loadError ? "alert" : "status"}>{syncMessage}</p>
          {loadError && (
            <button className="primary" onClick={() => void reload()}>
              再読み込み
            </button>
          )}
          <button
            className="secondary"
            onClick={() =>
              void logout().catch((e) => setSyncMessage(e.message))
            }
          >
            ログアウト
          </button>
          <p>
            保存済みデータはクラウドで保護されています。ブラウザへの代替保存は行いません。
          </p>
        </section>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className={mobile ? "sidebar mobile-open" : "sidebar"}>
        <a className="brand" href="#" onClick={() => go("ホーム")}>
          <div className="brand-icon">
            <Trophy size={23} />
          </div>
          <div>
            ROAD TO MVP<small>YOUR NEXT CHAPTER</small>
          </div>
        </a>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {tabs.map((name, i) => {
            const Icon = icons[i];
            return (
              <button
                key={name}
                className={tab === name ? "nav-item active" : "nav-item"}
                aria-current={tab === name ? "page" : undefined}
                onClick={() => go(name)}
              >
                <Icon size={19} />
                {name}
                {tab === name && <span className="nav-dot" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="award">
            <Sparkles size={17} />
            <span>
              目指す、その先の景色へ。<small>GEMCEREY AWARDS 2027</small>
            </span>
          </div>
          <div className="profile">
            <div className="avatar">M</div>
            <div>
              My workspace<small>パーソナルアカウント</small>
            </div>
            <span className="online" />
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="backdrop"
          aria-label="メニューを閉じる"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="workspace">
        <header>
          <div className="header-path">
            <button
              className="menu-btn"
              aria-label="メニュー"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={21} />
            </button>
            <span>ワークスペース</span>
            <ChevronRight size={14} />
            <strong>{tab}</strong>
          </div>
          <div className="header-right">
            <button
              className="logout-button"
              onClick={() => void logout().catch((e) => setNotice(e.message))}
            >
              ログアウト
            </button>
            <span className="live-dot" />
            PERSONAL EDITION<div className="avatar small">M</div>
          </div>
        </header>
        <main>
          <div className="cloud-status">
            <span className="live-dot" />
            <span role="status">
              {saving ? "クラウドに保存中…" : syncMessage}
              {lastSynced && !saving ? " · " + lastSynced : ""}
            </span>
            <button disabled={saving} onClick={() => void reload()}>
              最新を読み込む
            </button>
          </div>
          <div className="account-email">{user.email}</div>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {tab === "ホーム"
                  ? "YOUR JOURNEY TO THE TOP"
                  : "ROAD TO MVP / WORKSPACE"}
              </div>
              <h1>
                {tab === "ホーム" ? "一歩ずつ、MVPへ" : tab}
                <span className="gold-period">
                  {tab === "ホーム" ? "。" : "."}
                </span>
              </h1>
              <p>
                {tab === "ホーム"
                  ? "今日の積み重ねが、最高のステージにつながる。"
                  : "日々の行動を記録して、目標への道のりを確かなものに。"}
              </p>
            </div>
            <div className="date-chip">
              <CalendarDays size={16} />
              {today
                ? new Date(today + "T12:00:00").toLocaleDateString("ja-JP", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    weekday: "short",
                  })
                : "読み込み中"}
            </div>
          </div>
          {!ready ? (
            <div className="panel empty">データを読み込んでいます…</div>
          ) : (
            <>
              {tab === "ホーム" && (
                <>
                  <section className="hero">
                    <div className="hero-top">
                      <span className="pill">
                        <Trophy size={13} /> THE ROAD TO MVP 2027
                      </span>
                      <span className="hero-year">
                        ANNUAL SALES TARGET · {year}
                      </span>
                    </div>
                    <div className="hero-body">
                      <div>
                        <h2>頂点を目指す、あなたの挑戦。</h2>
                        <p>2027年10月、ジェムケリー表彰式の舞台へ。</p>
                        <div className="target-amount">
                          {yen(data.annual)}
                          <span>年間売上目標</span>
                        </div>
                      </div>
                      <div className="hero-emblem" aria-hidden="true">
                        <Trophy strokeWidth={1} size={100} />
                        <span>MAKE IT HAPPEN</span>
                      </div>
                    </div>
                    <div className="hero-footer">
                      <span>
                        <span className="live-dot" /> 挑戦は、今日から始まる。
                      </span>
                      <button onClick={() => go("目標管理")}>
                        目標を確認する <ArrowUpRight size={15} />
                      </button>
                    </div>
                  </section>
                  <div className="stats-grid">
                    <section className="stat">
                      <div className="stat-label">
                        年間売上実績
                        <TrendingUp size={17} />
                      </div>
                      <div className="stat-value">{yen(annualSales)}</div>
                      <div className="stat-foot">
                        目標まで{" "}
                        <strong>
                          {yen(Math.max(0, data.annual - annualSales))}
                        </strong>
                      </div>
                    </section>
                    <section className="stat">
                      <div className="stat-label">
                        年間目標達成率
                        <Flag size={17} />
                      </div>
                      <div className="stat-value">
                        {rate.toFixed(1)}
                        <span>%</span>
                      </div>
                      <div className="progress">
                        <i style={{ width: Math.min(100, rate) + "%" }} />
                      </div>
                      <div className="stat-foot">
                        一つの成果が、大きな一歩に。
                      </div>
                    </section>
                    <section className="stat">
                      <div className="stat-label">
                        今月の売上目標
                        <Target size={17} />
                      </div>
                      <div className="stat-value">
                        {yen(currentGoal.amount)}
                      </div>
                      <div className="stat-foot">
                        <span className="tiny-tag">
                          {Number(today.slice(5, 7))}月 ·{" "}
                          {currentGoal.mode === "auto" ? "自動" : "手動"}
                        </span>
                        実績{" "}
                        {yen(
                          data.sales
                            .filter((s) => s.date.startsWith(today.slice(0, 7)))
                            .reduce((n, s) => n + s.amount, 0),
                        )}
                      </div>
                      <button
                        className="goal-shortcut"
                        aria-label="今月の目標を設定"
                        onClick={() =>
                          open("目標", { goalMonth: today.slice(0, 7) })
                        }
                      >
                        自動・手動を変更
                        <ChevronRight size={12} />
                      </button>
                    </section>
                  </div>
                  <div className="home-columns">
                    <section className="panel">
                      <div className="section-title">
                        <h2>
                          <CalendarDays size={18} />
                          今日のスケジュール{" "}
                          <span className="count">{dayEvents.length}</span>
                        </h2>
                        <button
                          className="text-button"
                          onClick={() => go("スケジュール")}
                        >
                          すべて見る <ChevronRight size={14} />
                        </button>
                      </div>
                      {dayEvents.length ? (
                        dayEvents.map((e) => (
                          <div className="event-row" key={e.id}>
                            <time>{e.time}</time>
                            <div>
                              <strong>{e.title}</strong>
                              <small>{e.type}</small>
                            </div>
                            {e.meetingId
                              ? editButtons(
                                  "Zoom",
                                  "meetings",
                                  data.meetings.find(
                                    (m) => m.id === e.meetingId,
                                  )!,
                                )
                              : editButtons("予定", "events", e)}
                          </div>
                        ))
                      ) : (
                        <div className="empty">
                          <div className="empty-icon">
                            <CalendarDays size={26} />
                          </div>
                          <h3>今日の予定はまだありません</h3>
                          <p>新しい予定を追加して、一日を始めましょう。</p>
                          <button
                            className="secondary"
                            onClick={() => open("予定")}
                          >
                            <Plus size={15} />
                            予定を追加
                          </button>
                        </div>
                      )}
                    </section>
                    <section className="panel quick-panel">
                      <div className="section-title">
                        <h2>
                          <Sparkles size={18} />
                          クイックアクション
                        </h2>
                      </div>
                      {[
                        {
                          title: "売上を記録する",
                          sub: "小さな成果も、確かな実績に",
                          icon: TrendingUp,
                          kind: "売上",
                        },
                        {
                          title: "日報を書く",
                          sub: "今日を振り返り、明日につなげる",
                          icon: ClipboardList,
                          kind: "日報",
                        },
                        {
                          title: "Zoom会議を登録",
                          sub: "次の商談をスムーズに",
                          icon: Video,
                          kind: "Zoom",
                        },
                      ].map((a) => (
                        <button
                          className="quick-action"
                          key={a.kind}
                          onClick={() => open(a.kind)}
                        >
                          <span className="action-icon">
                            <a.icon size={18} />
                          </span>
                          <span>
                            <strong>{a.title}</strong>
                            <small>{a.sub}</small>
                          </span>
                          <ChevronRight size={15} />
                        </button>
                      ))}
                    </section>
                  </div>
                  <div className="quote">
                    <span>“</span>大きな目標は、今日の小さな行動から。
                    <span className="quote-line" />
                    KEEP MOVING FORWARD
                  </div>
                </>
              )}
              {tab === "スケジュール" && (
                <section className="panel calendar-panel">
                  <div className="toolbar">
                    <div className="calendar-controls">
                      <button aria-label="前へ" onClick={() => shift(-1)}>
                        <ChevronLeft size={18} />
                      </button>
                      <h2>
                        {cursorDate.getFullYear()}年{cursorDate.getMonth() + 1}
                        月{view === "日" ? cursorDate.getDate() + "日" : ""}
                      </h2>
                      <button aria-label="次へ" onClick={() => shift(1)}>
                        <ChevronRight size={18} />
                      </button>
                      <button
                        className="secondary"
                        onClick={() => setCursor(today)}
                      >
                        今日
                      </button>
                    </div>
                    <div className="toolbar">
                      <div className="segmented">
                        {["日", "週", "月"].map((v) => (
                          <button
                            className={view === v ? "selected" : ""}
                            key={v}
                            onClick={() => setView(v)}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                      <button
                        className="primary"
                        onClick={() => open("予定", { date: cursor })}
                      >
                        <Plus size={16} />
                        予定を追加
                      </button>
                    </div>
                  </div>
                  <div
                    className={"calendar " + (view === "日" ? "day-view" : "")}
                  >
                    {view !== "日" &&
                      ["日", "月", "火", "水", "木", "金", "土"].map((d) => (
                        <div className="weekday" key={d}>
                          {d}
                        </div>
                      ))}
                    {days.map((d) => {
                      const key = dateKey(d);
                      return (
                        <div
                          className={
                            "calendar-day " +
                            (key === today ? "is-today " : "") +
                            (d.getMonth() !== cursorDate.getMonth()
                              ? "muted-day"
                              : "")
                          }
                          key={key}
                        >
                          <button
                            className="day-number"
                            aria-label={key + "に予定追加"}
                            onClick={() => open("予定", { date: key })}
                          >
                            {d.getDate()}
                          </button>
                          {scheduledEvents
                            .filter((e) => e.date === key)
                            .sort((a, b) => a.time.localeCompare(b.time))
                            .map((e) => (
                              <button
                                className="calendar-event"
                                key={e.id}
                                onClick={() => {
                                  const meeting = e.meetingId
                                    ? data.meetings.find(
                                        (m) => m.id === e.meetingId,
                                      )
                                    : undefined;
                                  if (meeting)
                                    open(
                                      "Zoom",
                                      Object.fromEntries(
                                        Object.entries(meeting).map(
                                          ([k, v]) => [k, String(v)],
                                        ),
                                      ),
                                      meeting.id,
                                    );
                                  else open("予定", { ...e }, e.id);
                                }}
                              >
                                <time>{e.time}</time>{" "}
                                {e.meetingId ? "Zoom · " : ""}
                                {e.title}
                              </button>
                            ))}
                        </div>
                      );
                    })}
                  </div>
                  <p className="helper">
                    日付を押すと追加、予定を押すと編集・削除できます。Zoom管理の会議も自動表示します。
                  </p>
                </section>
              )}
              {tab === "Zoom管理" && (
                <>
                  <div className="zoom-create-container">
                    <ZoomCreate
                      onSaved={reload}
                      onManual={(meeting) =>
                        open(
                          "Zoom",
                          Object.fromEntries(
                            Object.entries(meeting).map(([k, v]) => [
                              k,
                              String(v),
                            ]),
                          ),
                          meeting.id,
                        )
                      }
                      onEditingChange={onZoomEditing}
                    />
                  </div>
                  <div className="list-heading">
                    <h2>
                      ミーティング{" "}
                      <span className="count">{data.meetings.length}</span>
                    </h2>
                    <button className="primary" onClick={() => open("Zoom")}>
                      <Plus size={16} />
                      会議を登録
                    </button>
                  </div>
                  <div className="cards-grid">
                    {data.meetings.map((m) => (
                      <section className="panel record-card" key={m.id}>
                        <div className="record-top">
                          <span className="pill">
                            <Video size={14} />
                            ZOOM MEETING
                          </span>
                          {editButtons("Zoom", "meetings", m)}
                        </div>
                        <h2>{m.title}</h2>
                        <p>
                          {m.date} · {m.time}
                          {m.duration ? " · " + m.duration + "分" : ""}
                          {m.timezone ? " / " + m.timezone : ""}
                        </p>
                        <p className="pre-wrap">{m.memo}</p>
                        <div className="meeting-url">{m.url}</div>
                        <button
                          className="secondary"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(m.url);
                              setNotice("リンクをコピーしました");
                            } catch {
                              setNotice(
                                "コピーできませんでした。表示中のURLを選択してコピーしてください。",
                              );
                            }
                          }}
                        >
                          <Copy size={15} />
                          リンクをコピー
                        </button>
                      </section>
                    ))}
                  </div>
                  {!data.meetings.length && (
                    <Empty
                      label="会議情報を登録して、商談の準備を。"
                      action={() => open("Zoom")}
                    />
                  )}
                </>
              )}
              {tab === "日報" && (
                <>
                  <div className="list-heading">
                    <h2>日々の記録</h2>
                    <button
                      className="primary"
                      onClick={() => {
                        const r = data.reports.find((r) => r.date === today);
                        open("日報", r ? { ...r } : {}, r?.id);
                      }}
                    >
                      <Plus size={16} />
                      今日の日報を書く
                    </button>
                  </div>
                  {!data.reports.length && (
                    <Empty
                      label="今日の気づきが、明日の成長につながる。"
                      action={() => open("日報")}
                    />
                  )}
                  <div className="cards-grid">
                    {[...data.reports]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((r) => (
                        <section className="panel record-card" key={r.id}>
                          <div className="record-top">
                            <h2>{r.date}</h2>
                            {editButtons("日報", "reports", r)}
                          </div>
                          {[
                            ["今日の成果", r.result],
                            ["反省", r.reflection],
                            ["原因", r.cause],
                            ["明日の改善行動", r.action],
                          ].map(([label, value]) => (
                            <div className="record-field" key={label}>
                              <small>{label}</small>
                              <p>{value}</p>
                            </div>
                          ))}
                        </section>
                      ))}
                  </div>
                </>
              )}
              {tab === "目標管理" && (
                <>
                  <div className="list-heading">
                    <h2>{year}年の目標と実績</h2>
                    <button
                      className="secondary"
                      onClick={() =>
                        open("目標", {
                          annual: String(data.annual),
                          goalMonth: month,
                        })
                      }
                    >
                      <Pencil size={15} />
                      目標を編集
                    </button>
                  </div>
                  <div className="stats-grid goal-stats">
                    <section className="stat">
                      <div className="stat-label">
                        年間売上目標
                        <Target size={18} />
                      </div>
                      <div className="stat-value">{yen(data.annual)}</div>
                      <p className="helper">
                        実績 {yen(annualSales)} / 達成率 {rate.toFixed(1)}%
                      </p>
                    </section>
                    <section className="stat">
                      <div className="stat-label">
                        月間売上目標
                        <Flag size={18} />
                      </div>
                      <div className="stat-value">
                        {yen(selectedGoal.amount)}
                      </div>
                      <p className="helper">
                        {month.replace("-", "年")}月 ·{" "}
                        {selectedGoal.mode === "auto"
                          ? "自動計算（年間目標 ÷ 12）"
                          : "手動で設定"}
                      </p>
                    </section>
                    <section className="stat">
                      <label className="stat-label">
                        対象月
                        <input
                          aria-label="売上の対象月"
                          type="month"
                          value={month}
                          onChange={(e) => setMonth(e.target.value)}
                        />
                      </label>
                      <div className="stat-value">{yen(monthlySales)}</div>
                      <p className="helper">
                        月間実績 / 達成率{" "}
                        {selectedGoal.amount
                          ? (
                              (monthlySales / selectedGoal.amount) *
                              100
                            ).toFixed(1)
                          : 0}
                        %
                      </p>
                    </section>
                  </div>
                  <section className="panel">
                    <div className="section-title">
                      <h2>売上実績</h2>
                      <button className="primary" onClick={() => open("売上")}>
                        <Plus size={16} />
                        売上を記録
                      </button>
                    </div>
                    {data.sales.filter((s) => s.date.startsWith(month))
                      .length ? (
                      data.sales
                        .filter((s) => s.date.startsWith(month))
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((s) => (
                          <div className="event-row" key={s.id}>
                            <time>{s.date}</time>
                            <div>
                              <strong>{s.title}</strong>
                              <small>{yen(s.amount)}</small>
                            </div>
                            {editButtons("売上", "sales", s)}
                          </div>
                        ))
                    ) : (
                      <div className="empty">
                        <TrendingUp size={28} />
                        <h3>この月の売上はまだありません</h3>
                        <p>最初の成果を記録しましょう。</p>
                      </div>
                    )}
                  </section>
                </>
              )}
              {tab === "月間振り返り" && (
                <>
                  <div className="list-heading">
                    <h2>成長の軌跡</h2>
                    <button
                      className="primary"
                      onClick={() => {
                        const r = data.reviews.find((r) => r.month === month);
                        open("振り返り", r ? { ...r } : {}, r?.id);
                      }}
                    >
                      <Plus size={16} />
                      月の振り返りを書く
                    </button>
                  </div>
                  {!data.reviews.length && (
                    <Empty
                      label="一か月の経験を、次の一歩の力に。"
                      action={() => open("振り返り")}
                    />
                  )}
                  <div className="cards-grid">
                    {[...data.reviews]
                      .sort((a, b) => b.month.localeCompare(a.month))
                      .map((r) => (
                        <section className="panel record-card" key={r.id}>
                          <div className="record-top">
                            <h2>{r.month.replace("-", "年")}月</h2>
                            {editButtons("振り返り", "reviews", r)}
                          </div>
                          {[
                            ["月の成果", r.result],
                            ["反省", r.reflection],
                            ["翌月の改善目標", r.action],
                          ].map(([label, value]) => (
                            <div className="record-field" key={label}>
                              <small>{label}</small>
                              <p>{value}</p>
                            </div>
                          ))}
                        </section>
                      ))}
                  </div>
                </>
              )}
            </>
          )}
          <LegacyImport
            disabled={saving}
            onImport={async (legacy) =>
              save(mergeLegacy(data, legacy, revision.current === 0))
            }
          />
          <footer>
            <span>ROAD TO MVP</span>
            <span>あなただけの、頂点への道。</span>
            <span>クラウド保存 · 自分専用</span>
          </footer>
        </main>
      </div>
      <nav className="mobile-dock" aria-label="画面の切り替え">
        {tabs.map((name, i) => {
          const Icon = icons[i];
          return (
            <button
              key={name}
              aria-label={name}
              aria-current={tab === name ? "page" : undefined}
              className={tab === name ? "dock-item selected" : "dock-item"}
              onClick={() => go(name)}
            >
              <Icon size={20} />
              <span>
                {["ホーム", "予定", "Zoom", "日報", "目標", "振り返り"][i]}
              </span>
            </button>
          );
        })}
      </nav>
      {notice && (
        <div role="status" className="toast">
          <Check size={16} />
          {notice}
        </div>
      )}
      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-title">
              <h2 id="modal-title">
                {form.kind}
                {form.id ? "を編集" : "を登録"}
              </h2>
              <button aria-label="閉じる" onClick={() => setForm(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submit}>
              <fieldset disabled={saving} className="form-fields">
                {form.kind === "目標" ? (
                  <GoalFields
                    data={data}
                    month={form.values.goalMonth || month}
                  />
                ) : (
                  <>
                    {form.kind === "振り返り" ? (
                      <Field
                        label="対象月"
                        name="month"
                        type="month"
                        value={form.values.month}
                      />
                    ) : (
                      <Field
                        label="日付"
                        name="date"
                        type="date"
                        value={form.values.date}
                      />
                    )}
                    {["予定", "Zoom"].includes(form.kind) && (
                      <Field
                        label="開始時刻"
                        name="time"
                        type="time"
                        value={form.values.time}
                      />
                    )}
                    {["予定", "Zoom", "売上"].includes(form.kind) && (
                      <Field
                        label={
                          form.kind === "売上" ? "売上内容・顧客名" : "タイトル"
                        }
                        name="title"
                        value={form.values.title}
                      />
                    )}
                    {form.kind === "予定" && (
                      <label>
                        予定の種類
                        <select
                          name="type"
                          defaultValue={form.values.type || "商談"}
                        >
                          {["商談", "訪問", "電話", "作業", "その他"].map(
                            (t) => (
                              <option key={t}>{t}</option>
                            ),
                          )}
                        </select>
                      </label>
                    )}
                    {form.kind === "Zoom" && (
                      <>
                        <Field
                          label="会議リンク（https://）"
                          name="url"
                          type="url"
                          value={form.values.url}
                        />
                        <label>
                          メモ
                          <textarea
                            name="memo"
                            defaultValue={form.values.memo}
                          />
                        </label>
                      </>
                    )}
                    {form.kind === "売上" && (
                      <Field
                        label="売上金額（円）"
                        name="amount"
                        type="number"
                        value={form.values.amount}
                      />
                    )}
                    {["日報", "振り返り"].includes(form.kind) && (
                      <>
                        {[
                          [
                            form.kind === "日報" ? "今日の成果" : "月の成果",
                            "result",
                          ],
                          ["反省", "reflection"],
                          ...(form.kind === "日報" ? [["原因", "cause"]] : []),
                          [
                            form.kind === "日報"
                              ? "明日の改善行動"
                              : "翌月の改善目標",
                            "action",
                          ],
                        ].map(([label, name]) => (
                          <label key={name}>
                            {label}
                            <textarea
                              name={name}
                              required
                              maxLength={5000}
                              defaultValue={form.values[name]}
                            />
                          </label>
                        ))}
                      </>
                    )}
                  </>
                )}
                <div className="modal-actions">
                  {form.id && (
                    <button
                      type="button"
                      className="danger"
                      onClick={async () => {
                        const key = (
                          {
                            予定: "events",
                            Zoom: "meetings",
                            日報: "reports",
                            振り返り: "reviews",
                            売上: "sales",
                          } as const
                        )[
                          form.kind as
                            "予定" | "Zoom" | "日報" | "振り返り" | "売上"
                        ];
                        if (
                          confirm("このデータを削除しますか？") &&
                          (await save({
                            ...data,
                            [key]: data[key].filter((x) => x.id !== form.id),
                          }))
                        )
                          setForm(null);
                      }}
                    >
                      削除
                    </button>
                  )}
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setForm(null)}
                  >
                    キャンセル
                  </button>
                  <button className="primary" type="submit">
                    保存する
                  </button>
                </div>
              </fieldset>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
function Field({
  label,
  name,
  type = "text",
  value,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required
        maxLength={type === "text" ? 200 : undefined}
        min={type === "number" ? 1 : undefined}
        max={type === "number" ? 999999999999 : undefined}
        step={type === "number" ? 1 : undefined}
        pattern={type === "url" ? "https://.*" : undefined}
      />
    </label>
  );
}
function Empty({ label, action }: { label: string; action: () => void }) {
  return (
    <div className="panel empty">
      <div className="empty-icon">
        <ClipboardList size={27} />
      </div>
      <h3>まだ記録がありません</h3>
      <p>{label}</p>
      <button className="secondary" onClick={action}>
        <Plus size={16} />
        最初の記録を追加
      </button>
    </div>
  );
}
