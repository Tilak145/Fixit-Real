// Runs the website on this computer against the TEST database (fixit-test), so
// trying things out can never touch real customers. Open http://localhost:3100.
//
// The values below are the test project's public address and public (anon) key.
// They are meant to be in browsers; no secret key belongs here.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: "https://mcmekpanodhzkdisvaiy.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jbWVrcGFub2RoemtkaXN2YWl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU4MzM4MDEsImV4cCI6MjExMTQwOTgwMX0.MqQWpKxw8Qd6QfRoWXxKwt4IJSn_jAn-hepB4j4YTzE",
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
