import { fileURLToPath } from "node:url";

/** @type {import("next").NextConfig} */
const config = {
  // Next 16.2's development RSC channel is carried over the HMR WebSocket.
  // The preview uses an isolated origin, so allow the platform-owned preview
  // hosts (and the sandbox-local browser) to complete that handshake.
  allowedDevOrigins: [
    "127.0.0.1",
    "*.preview.exaspark.app",
    "*.preview-dev.exaspark.app",
  ],
  poweredByHeader: false,
  webpack(webpackConfig, { dev }) {
    webpackConfig.module.rules.push({
      test: /[\\/]app[\\/](?:spk-theme\.css|spk-design-theme\.mjs)$/u,
      enforce: "pre",
      use: [{ loader: fileURLToPath(new URL("./spk-design-loader.cjs", import.meta.url)) }],
    });
    // ExaSpark Preview element selection: development-only source tags.
    if (dev) {
      webpackConfig.module.rules.push({
        test: /\.[jt]sx$/u,
        exclude: /node_modules/u,
        enforce: "pre",
        use: [{ loader: fileURLToPath(new URL("./spk-source-tagger.mjs", import.meta.url)) }],
      });
    }
    return webpackConfig;
  },
};

export default config;
