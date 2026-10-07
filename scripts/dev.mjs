import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const children = [
  spawn("npx next dev --webpack --port 3000", {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, PORT: "3000" },
  }),
  spawn("npm run start:watch", {
    cwd: resolve(root, "apps/api"),
    stdio: "inherit",
    shell: true,
    env: { ...process.env, PORT: "4000", API_PORT: "4000" },
  }),
];

let closing = false;
function stop(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill();
  process.exit(code);
}

for (const child of children) {
  child.on("exit", (code) => {
    if (!closing) stop(code ?? 1);
  });
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
