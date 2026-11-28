// Runs the website on this computer against the TEST database (fixit-test), so
// trying things out can never touch real customers. Open http://localhost:3100.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { TEST_DATABASE_ENV } from "../test-database.mjs";

const env = {
  ...process.env,
  ...TEST_DATABASE_ENV,
  NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
  // A separate build folder, so nothing compiled for the live database is reused.
  FIXIT_DIST_DIR: ".next-test",
};

const next = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const child = spawn(process.execPath, [next, "dev", "--webpack", "-p", "3100"], {
  cwd: fileURLToPath(new URL("..", import.meta.url)),
  env,
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 0));
