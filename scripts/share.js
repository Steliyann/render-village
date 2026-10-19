const { spawn } = require('node:child_process');
const http = require('node:http');

const port = Number(process.env.PORT) || 4173;
const children = new Set();
let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = exitCode;
}

function run(command, args) {
  const child = spawn(command, args, { env: process.env, stdio: 'inherit' });
  children.add(child);
  child.once('exit', code => {
    children.delete(child);
    if (!stopping) stop(code ?? 1);
  });
  child.once('error', error => {
    console.error(`Could not start ${command}: ${error.message}`);
    stop(1);
  });
  return child;
}

function waitForServer(attempts = 40) {
  return new Promise((resolve, reject) => {
    const check = remaining => {
      const request = http.get(`http://127.0.0.1:${port}/health`, response => {
        response.resume();
        if (response.statusCode === 200) return resolve();
        retry(remaining);
      });
      request.once('error', () => retry(remaining));
      request.setTimeout(500, () => request.destroy());
    };
    const retry = remaining => {
      if (remaining <= 1) return reject(new Error(`Server did not become ready on port ${port}.`));
      setTimeout(() => check(remaining - 1), 250);
    };
    check(attempts);
  });
}

process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());

const server = run(process.execPath, ['server.js']);

waitForServer()
  .then(() => {
    console.log('\nStarting Cloudflare Quick Tunnel. Share the https://*.trycloudflare.com URL printed below.\n');
    run('cloudflared', ['tunnel', '--url', `http://127.0.0.1:${port}`]);
  })
  .catch(error => {
    console.error(error.message);
    stop(1);
  });

server.once('exit', () => stop(1));