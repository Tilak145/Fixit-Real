import { fileURLToPath } from "node:url";

/** @type {import("next").NextConfig} */
const config = {
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
