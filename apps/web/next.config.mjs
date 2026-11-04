import { fileURLToPath } from "node:url";

/** @type {import("next").NextConfig} */
const config = {
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
