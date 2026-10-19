# Village After Dark Deployment

## Local development

Install dependencies and run the server:

```text
npm install
npm start
```

The application is available at `http://localhost:4173` by default. Set `PORT` to use another local port:

```text
PORT=4174 npm start
```

The health endpoint is available at `/health` and returns the server status and current session count.

## Persistence

The current release intentionally uses in-memory session state. Active lobbies, games, players, and reconnect records are lost when the Node.js process stops or restarts. Persistent accounts, game history, and resumable games are outside the current release scope.

## Remote access

### Share from your laptop with a random URL

[Cloudflare Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) are the simplest option for temporary games across different networks. No Cloudflare account or domain is required.

1. Install the official `cloudflared` executable on the host laptop. On Windows, download the 64-bit executable or MSI from [Cloudflare's downloads page](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) and ensure `cloudflared` is available on `PATH`.
2. Install this project's dependencies with `npm install`.
3. Start the game and tunnel together:

```text
npm run share
```

4. Copy the generated `https://<random-words>.trycloudflare.com` URL from the terminal and send it to the other players. Keep the terminal and laptop running for the duration of the game. Press `Ctrl+C` to stop both the game server and tunnel.

To use another port, set `PORT` before running the command. In PowerShell:

```powershell
$env:PORT=4174; npm run share
```

Quick Tunnels are intended for temporary testing and casual sessions. The URL changes each time, has no uptime guarantee, and the game state is lost when the process stops. For a permanent public deployment, use a named Cloudflare Tunnel or a Node.js hosting provider with HTTPS and WebSocket support.

For a controlled local-network test, expose the selected port only to trusted devices on the same network. For other Internet access methods, place the application behind a trusted HTTPS reverse proxy or tunneling service.

Remote access requirements:

- Use HTTPS/WSS in production.
- Restrict access to trusted players or add authentication before public deployment.
- Do not expose the development server directly to the public Internet without a proxy, TLS, and access controls.
- Configure the proxy to forward WebSocket upgrades to `/ws`.
- Monitor `/health` for process availability.

The server does not currently provide user authentication, persistent storage, TLS termination, or rate-limit coordination across multiple Node.js processes.

## Shutdown

Use `Ctrl+C` or send `SIGTERM`. The server closes connected WebSocket clients and then closes the HTTP listener gracefully.

## Release checks

Run the automated checks before a release:

```text
npm test
node --check server.js
node --check app.js
```

The current automated suite covers game rules, permissions, role interactions, lobby protocol behavior, session isolation, health checks, and static-file traversal protection. Browser-level visual testing remains a manual release step until a browser automation dependency is added.
