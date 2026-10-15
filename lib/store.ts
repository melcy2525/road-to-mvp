export type Event = {
  id: string;
  date: string;
  time: string;
  title: string;
  type: string;
};
export type Meeting = {
  id: string;
  date: string;
  time: string;
  title: string;
  url: string;
  memo: string;
};
export type Report = {
  id: string;
  date: string;
  result: string;
  reflection: string;
  cause: string;
  action: string;
};
export type Review = {
  id: string;
  month: string;
  result: string;
  reflection: string;
  action: string;
};
export type Sale = { id: string; date: string; title: string; amount: number };
export type Data = {
  annual: number;
  monthly: number;
  events: Event[];
  meetings: Meeting[];
  reports: Report[];
  reviews: Review[];
  sales: Sale[];
};
export const initialData: Data = {
  annual: 50000000,
  monthly: 4200000,
  events: [],
  meetings: [],
  reports: [],
  reviews: [],
  sales: [],
};
// Replace this repository with an API adapter when connecting a database.
export const repository = {
  load(): Data {
    const raw = localStorage.getItem("road-to-mvp:v1");
    if (!raw) return structuredClone(initialData);
    const data = JSON.parse(raw);
    if (
      !data ||
      !["events", "meetings", "reports", "reviews", "sales"].every((key) =>
        Array.isArray(data[key]),
      ) ||
      !Number.isFinite(data.annual) ||
      !Number.isFinite(data.monthly)
    )
      throw new Error("保存データの形式が正しくありません");
    return data;
  },
  save(data: Data) {
    localStorage.setItem("road-to-mvp:v1", JSON.stringify(data));
  },
};
export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const yen = (n: number) =>
  new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(n);
