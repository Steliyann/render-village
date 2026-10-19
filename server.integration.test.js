const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const WebSocket = require('ws');

function waitForType(socket, type, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.removeListener('message', onMessage);
      reject(new Error(`Timed out waiting for ${type}`));
    }, timeout);
    function onMessage(data) {
      const message = JSON.parse(data.toString());
      if (message.type !== type) return;
      clearTimeout(timer);
      socket.removeListener('message', onMessage);
      resolve(message);
    }
    socket.on('message', onMessage);
  });
}

function connect(port) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://localhost:${port}/ws`);
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

function request(port, path) {
  return new Promise((resolve, reject) => {
    const request = http.get({ port, path }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ statusCode: response.statusCode, body }));
    });
    request.once('error', reject);
  });
}

test('isolates players through create and join lobby protocol', async () => {
  const port = 4300 + Math.floor(Math.random() * 400);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore'
  });
  const sockets = [];
  try {
    let first;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        first = await connect(port);
        break;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    assert.ok(first, 'server did not accept a WebSocket connection');
    sockets.push(first);
    await waitForType(first, 'welcome');
    first.send(JSON.stringify({ type: 'create-lobby', name: 'TEST-EPIC4' }));
    const created = await waitForType(first, 'lobby-joined');
    first.send(JSON.stringify({ type: 'create-lobby', name: 'TEST-EPIC5' }));
    const duplicateLobby = await waitForType(first, 'error');
    assert.equal(duplicateLobby.code, 'ALREADY_HOSTING');
    first.send(JSON.stringify({ type: 'join', name: 'Alice', gender: 'female' }));
    await waitForType(first, 'identity-accepted');

    const second = await connect(port);
    sockets.push(second);
    await waitForType(second, 'welcome');
    second.send(JSON.stringify({ type: 'join-lobby', code: 'TEST-EPIC4' }));
    const joined = await waitForType(second, 'lobby-joined');
    second.send(JSON.stringify({ type: 'join', name: 'Bob', gender: 'male' }));
    const accepted = await waitForType(second, 'identity-accepted');

    assert.equal(created.roomState.code, 'TEST-EPIC4');
    assert.equal(joined.room.code, 'TEST-EPIC4');
    assert.equal(accepted.room.code, 'TEST-EPIC4');
    assert.equal(accepted.room.players.length, 2);

    second.send(JSON.stringify({ type: 'join', name: 'Alice', gender: 'male' }));
    const duplicate = await waitForType(second, 'error');
    assert.equal(duplicate.code, 'NAME_TAKEN');

    second.send('{malformed');
    const malformed = await waitForType(second, 'error');
    assert.equal(malformed.message, 'Messages must be valid JSON.');
  } finally {
    for (const socket of sockets) socket.close();
    child.kill();
  }
});

test('exposes health and rejects traversal paths', async () => {
  const port = 4700 + Math.floor(Math.random() * 200);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore'
  });
  try {
    let health;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        health = await request(port, '/health');
        break;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    assert.equal(health.statusCode, 200);
    assert.equal(JSON.parse(health.body).status, 'ok');
    const traversal = await request(port, '/%2e%2e/%2e%2e/package.json');
    assert.equal(traversal.statusCode, 403);
  } finally {
    child.kill();
  }
});
