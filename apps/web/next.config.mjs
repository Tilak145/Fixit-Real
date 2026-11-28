import { fileURLToPath } from "node:url";
import { TEST_DATABASE_ENV } from "./test-database.mjs";

// The private test link for the property work (Vercel's preview of this branch)
// is built against the test database, whatever the host's settings say, so it
// can never read or change live data. Production builds are not affected.
const testPreview = process.env.VERCEL_ENV === "preview" && process.env.VERCEL_GIT_COMMIT_REF === "property-management";
if (testPreview) Object.assign(process.env, TEST_DATABASE_ENV);

/** @type {import("next").NextConfig} */
const config = {
  ...(testPreview ? { env: TEST_DATABASE_ENV } : {}),
  // The test-database server (scripts/dev-test.mjs) builds into its own folder.
  distDir: process.env.FIXIT_DIST_DIR || ".next",
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  webpack(webpackConfig) {
    webpackConfig.module.rules.push({
      test: /[\\/]app[\\/](?:spk-theme\.css|spk-design-theme\.mjs)$/u,
      enforce: "pre",
      use: [{ loader: fileURLToPath(new URL("./spk-design-loader.cjs", import.meta.url)) }],
    });
    return webpackConfig;
  },
};

export default config;
