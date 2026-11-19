import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { readFile, readdir } from 'node:fs/promises';
import { extname } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import { Game } from './game.ts';
import { DIRECTIONS, TUNING, isRecord, readSettings } from './rules.ts';
import type { Direction, ServerMessage } from './rules.ts';

const port = Number(process.env.PORT ?? 3000);
const dist = new URL('../dist/', import.meta.url);
const files = new Map<string, { bytes: Buffer; type: string }>();
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};
try {
  const assets = await readdir(new URL('assets/', dist), { withFileTypes: true });
  for (const path of ['index.html', ...assets.filter(asset => asset.isFile()).map(asset => `assets/${asset.name}`)]) {
    const type = types[extname(path)];
    if (type) files.set(path === 'index.html' ? '/' : `/${path}`, { bytes: await readFile(new URL(path, dist)), type });
  }
} catch (error) {
  console.error('Could not load the browser build. Run npm run build first.', error);
  process.exit(1);
}

const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const path = request.url?.split('?')[0] ?? '';
  const file = files.get(path === '/watch' || path === '/watch/' ? '/' : path);
  if (!file) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': file.type, 'Content-Length': file.bytes.length, 'X-Content-Type-Options': 'nosniff',
  }).end(request.method === 'HEAD' ? undefined : file.bytes);
});
const sockets = new WebSocketServer({ noServer: true, maxPayload: 2048 });
server.on('upgrade', (request, socket, head) => {
  if ((request.url !== '/game' && request.url !== '/watch/live') ||
      request.headers.origin !== `http://${request.headers.host}`) {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    return;
  }
  sockets.handleUpgrade(request, socket, head, client => sockets.emit('connection', client, request));
});

const game = new Game();
const alive = new Set<WebSocket>();
function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}
function broadcast(): void {
  const snapshot = JSON.stringify({ type: 'state', state: game.state } satisfies ServerMessage);
  for (const client of sockets.clients) {
    if (client.readyState === WebSocket.OPEN && client.bufferedAmount < 64 * 1024) client.send(snapshot);
  }
}

sockets.on('connection', (socket, request) => {
  const id = request.url === '/watch/live' ? null : randomUUID();
  alive.add(socket);
  socket.on('pong', () => alive.add(socket));
  if (id !== null) send(socket, { type: 'hello', id });
  send(socket, { type: 'state', state: game.state });
  socket.on('message', raw => {
    const respond = (message: string) => send(socket, { type: 'error', message });
    if (id === null) return respond('Spectators cannot send game commands.');
    let command: unknown;
    try {
      command = JSON.parse(raw.toString());
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      respond('Invalid message.');
      return;
    }
    if (!isRecord(command)) return respond('Invalid message.');
    let error: string | undefined;
    if (command.type === 'join') {
      const name = typeof command.name === 'string' ? command.name.trim() : '';
      error = name && name.length <= 24 ? game.join(id, name) : 'Enter a name of 1–24 characters.';
    } else {
      if (!game.state.players.some(player => player.id === id)) return respond('Join first.');
      switch (command.type) {
        case 'input': {
          const direction = command.direction;
          if (direction === null || isDirection(direction)) game.input(id, direction);
          else respond('Invalid direction.');
          return;
        }
        case 'use-item':
          game.useItem(id, Date.now());
          return;
        case 'team':
          error = command.team === 'red' || command.team === 'blue' ? game.switchTeam(id, command.team) : 'Invalid team.';
          break;
        case 'settings':
        case 'start':
        case 'next':
        case 'reset': {
          if (id !== game.state.host) return respond('Only the lobby host can do that.');
          if (command.type === 'settings') {
            const settings = readSettings(command.settings);
            error = settings ? game.configure(settings) : 'Invalid lobby settings.';
          } else if (command.type === 'start') error = game.start(Date.now());
          else if (command.type === 'next') error = game.next(Date.now());
          else game.reset();
          break;
        }
        default:
          return respond('Unknown command.');
      }
    }
    if (error) respond(error);
    else broadcast();
  });
  socket.on('close', () => {
    alive.delete(socket);
    if (id !== null && game.state.players.some(player => player.id === id)) {
      game.leave(id);
      broadcast();
    }
  });
  socket.on('error', error => console.error('WebSocket error:', error.message));
});

function isDirection(value: unknown): value is Direction {
  return typeof value === 'string' && Object.hasOwn(DIRECTIONS, value);
}

setInterval(() => {
  if (game.state.phase !== 'playing') return;
  game.tick(Date.now());
  broadcast();
}, TUNING.tickMs).unref();

setInterval(() => {
  for (const client of sockets.clients) {
    if (!alive.delete(client)) client.terminate();
    else if (client.readyState === WebSocket.OPEN) client.ping();
  }
}, 5000).unref();

server.listen(port, '0.0.0.0', () => {
  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : port;
  console.log(`Host: http://localhost:${boundPort}`);
  console.log(`Watch: http://localhost:${boundPort}/watch`);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const entry of addresses ?? []) {
      if (!entry.internal && entry.family === 'IPv4') console.log(`LAN:  http://${entry.address}:${boundPort}`);
    }
  }
});
