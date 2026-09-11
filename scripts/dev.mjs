#!/usr/bin/env node
/**
 * Run the API and the Vite dev server together.
 *
 * A tiny spawner rather than a dependency on concurrently: two processes, one
 * Ctrl-C, and prefixed output so it is clear which side logged what.
 */

import { spawn } from 'node:child_process';

const targets = [
  { name: 'api', colour: '\x1b[38;5;61m', args: ['run', '-w', '@ale/server', 'dev'] },
  { name: 'web', colour: '\x1b[38;5;65m', args: ['run', '-w', '@ale/web', 'dev'] },
];

const RESET = '\x1b[0m';
const children = [];
let shuttingDown = false;

for (const target of targets) {
  const child = spawn('npm', target.args, { stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);

  const prefix = `${target.colour}${target.name.padEnd(3)}${RESET} │ `;
  const forward = (stream, out) => {
    stream.on('data', (chunk) => {
      for (const line of String(chunk).split('\n')) {
        if (line.trim()) out.write(`${prefix}${line}\n`);
      }
    });
  };

  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);

  child.on('exit', (code) => {
    if (shuttingDown) return;
    console.error(`${prefix}exited with code ${code}. Stopping the other process.`);
    shutdown(code ?? 1);
  });
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 200);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const API_PORT = process.env.PORT ?? '7420';
const WEB_PORT = process.env.ALE_WEB_PORT ?? '7430';

console.log(`API  http://localhost:${API_PORT}/api`);
console.log(`Web  http://localhost:${WEB_PORT}`);
