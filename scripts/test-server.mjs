import { spawn } from "node:child_process";
const unconfigured = process.argv.includes("--unconfigured");
const env = {
  ...process.env,
  ROAD_TEST_BUILD: "1",
  NEXT_PUBLIC_SUPABASE_URL: "https://road-test.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_only",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
};
if (unconfigured) {
  env.ROAD_TEST_BUILD = "unconfigured";
  env.NEXT_PUBLIC_SUPABASE_URL = "";
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "";
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
}
const build = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  { env, stdio: "inherit" },
);
let server;
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    build.kill(signal);
    server?.kill(signal);
    process.exit(0);
  });
build.on("exit", (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
  }
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      unconfigured ? "3101" : "3100",
    ],
    { env, stdio: "inherit" },
  );
  server.on("exit", (code) => process.exit(code ?? 1));
});
