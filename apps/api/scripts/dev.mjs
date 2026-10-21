// API dev server. `nest start --watch` only restarted on its own successful compiles of src/, so changes it didn't
// see (a rebuilt @truhost/shared, a regenerated Prisma client) or a compile with a passing type error left the old
// server running with new code around it. Here compiling and running are separate:
//   - `prisma generate --watch` regenerates the Prisma client when the schema changes;
//   - `nest build --watch` compiles src/ into dist/ (type errors are still printed). Whenever the checkout moves to
//     another commit (a pull, checkout, merge or rebase), compiler and server are restarted from a clean dist/:
//     TypeScript's file watcher can miss files that git replaces, which once left a pulled module out of the API;
//   - `node --watch` runs the API and restarts whenever any file it loaded changes: dist/, the generated Prisma
//     client and the workspace packages alike.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const children = new Set();
/** Children being stopped on purpose (a rebuild): their exit doesn't stop the rest. */
const retiring = new Set();
const run = (command, args) => {
  const child = spawn(command, args, { stdio: 'inherit' });
  children.add(child);
  child.on('exit', (code, signal) => {
    children.delete(child);
    // node --watch exits with code 0 (not the signal) when it's stopped, so a planned stop is recognised by name.
    if (signal || stopping || retiring.delete(child)) return;
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

/** The checked-out commit, or null outside a git checkout. */
const head = () => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

// Every start compiles from a clean dist/, so the server never runs a stale file from an earlier compile.
const compile = () => {
  rmSync('dist', { recursive: true, force: true });
  return run('nest', ['build', '--watch', '--preserveWatchOutput']);
};

// Regenerate the Prisma client whenever the schema changes (a pull, a branch switch, an edit), so the server never
// runs a client that's missing models; node --watch below restarts it on the new client. (Turbo generates it once
// before `pnpm dev` starts; this keeps it current after that.)
run('prisma', ['generate', '--watch']);

/** Compiles from a clean dist/, then serves it, restarting on any change to what it loaded. */
const start = async () => {
  const compiler = compile();
  while (!existsSync('dist/main.js')) await sleep(200);
  // Let the first compile finish writing before starting the server.
  await sleep(500);
  const server = run(process.execPath, ['--enable-source-maps', '--watch', 'dist/main.js']);
  return { compiler, server };
};
const exited = (child) =>
  new Promise((done) => {
    if (child.exitCode !== null || child.signalCode !== null) return done();
    retiring.add(child);
    child.once('exit', done);
    child.kill('SIGTERM');
  });

let current = await start();

// A new commit checked out: stop the server and the compiler, and start again from a clean build, exactly as
// `pnpm dev` does. (Deleting dist/ under a running node --watch leaves it waiting on files that no longer exist.)
let checkedOut = head();
let rebuilding = false;
setInterval(async () => {
  const now = head();
  if (!now || now === checkedOut || stopping || rebuilding) return;
  checkedOut = now;
  rebuilding = true;
  console.log(`[dev] checkout moved to ${now.slice(0, 7)}: rebuilding from clean`);
  await Promise.all([exited(current.compiler), exited(current.server)]);
  if (!stopping) current = await start();
  rebuilding = false;
}, 2000).unref();
