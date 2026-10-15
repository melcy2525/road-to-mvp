import type { NextConfig } from "next";
// Browser tests build separately with a mocked Supabase endpoint; never ship test keys.
const config: NextConfig = {
  distDir:
    process.env.ROAD_TEST_BUILD === "unconfigured"
      ? ".next-unconfigured"
      : process.env.ROAD_TEST_BUILD === "1"
        ? ".next-test"
        : ".next",
};
export default config;
