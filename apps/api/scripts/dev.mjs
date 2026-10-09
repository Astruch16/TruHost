// API dev server. `nest start --watch` only restarted on its own successful compiles of src/, so changes it didn't
// see (a rebuilt @truhost/shared, a regenerated Prisma client) or a compile with a passing type error left the old
// server running with new code around it. Here compiling and running are separate:
//   - `nest build --watch` compiles src/ into dist/ (type errors are still printed);
//   - `node --watch` runs the API and restarts whenever any file it loaded changes: dist/, the generated Prisma
//     client and the workspace packages alike.
import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const children = [];
const run = (command, args) => {
  const child = spawn(command, args, { stdio: 'inherit' });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (signal || stopping) return;
    console.error(`[dev] ${command} exited (${code}); stopping`);
    stop(code ?? 1);
  });
  return child;
};

let stopping = false;
const stop = (code = 0) => {
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exit(code);
};
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

// Start from a clean build so the server never runs a stale file from an earlier compile.
rmSync('dist', { recursive: true, force: true });
run('nest', ['build', '--watch', '--preserveWatchOutput']);
while (!existsSync('dist/main.js')) await sleep(200);
// Let the first compile finish writing before starting the server.
await sleep(500);
run(process.execPath, ['--enable-source-maps', '--watch', 'dist/main.js']);
