import type { SupabaseClient } from "@supabase/supabase-js";
import { initialData, parseData, type Data } from "./store";
export type Snapshot = { data: Data; revision: number };
export class CloudError extends Error {}
export class ConflictError extends CloudError {}
export function createRepository(client: SupabaseClient, userId: string) {
  return {
    async load(): Promise<Snapshot> {
      const owner = await client
        .from("app_owner")
        .select("user_id")
        .eq("user_id", userId)
        .retry(false)
        .abortSignal(AbortSignal.timeout(15000))
        .maybeSingle();
      if (owner.error)
        throw new CloudError(
          "接続を確認できません。Supabaseの設定・SQLマイグレーション・通信状態を確認してください。",
        );
      if (!owner.data)
        throw new CloudError(
          "このアカウントにはアクセス権がありません。Supabaseの所有者設定を確認してください。",
        );
      const created = await client
        .from("workspaces")
        .upsert(
          { user_id: userId, state: initialData, revision: 0 },
          { onConflict: "user_id", ignoreDuplicates: true },
        )
        .abortSignal(AbortSignal.timeout(15000));
      if (created.error)
        throw new CloudError(
          "クラウドを初期化できません。SQL・所有者設定・通信状態を確認してください。",
        );
      // Recover links already issued by Zoom if the previous browser closed
      // before workspace persistence completed. Missing migration 002 must not
      // block the existing dashboard; Zoom creation reports that requirement.
      const pending = await client
        .from("zoom_requests")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "ready")
        .limit(10)
        .retry(false)
        .abortSignal(AbortSignal.timeout(15000));
      if (!pending.error && pending.data) {
        for (const request of pending.data) {
          const saved = await client
            .rpc("save_zoom_meeting", { p_request_id: request.id })
            .abortSignal(AbortSignal.timeout(15000));
          if (saved.error) break;
        }
      }
      const result = await client
        .from("workspaces")
        .select("state,revision")
        .eq("user_id", userId)
        .retry(false)
        .abortSignal(AbortSignal.timeout(15000))
        .single();
      if (result.error || !result.data)
        throw new CloudError(
          "クラウドを読み込めません。接続を確認して再試行してください。",
        );
      return {
        data: parseData(result.data.state),
        revision: result.data.revision,
      };
    },
    async save(data: Data, revision: number): Promise<Snapshot> {
      const valid = parseData(data);
      const result = await client
        .from("workspaces")
        .update({ state: valid, revision: revision + 1 })
        .eq("user_id", userId)
        .eq("revision", revision)
        .select("state,revision")
        .abortSignal(AbortSignal.timeout(15000))
        .maybeSingle();
      if (result.error)
        throw new CloudError(
          "クラウド保存に失敗しました。通信状態・ログイン状態を確認して再試行してください。",
        );
      if (!result.data)
        throw new ConflictError(
          "別の端末で更新されています。最新データを読み込み、内容を確認してから保存し直してください。",
        );
      return {
        data: parseData(result.data.state),
        revision: result.data.revision,
      };
    },
  };
}
