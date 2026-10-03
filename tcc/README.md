# θchat Client

A browser-based, peer-to-peer text chat client built with Preact and libp2p.

## Run

```sh
npm install
npm run dev
```

Open the Vite URL in a modern browser. Use localhost for development or HTTPS
when deployed (WebRTC and browser cryptography need a secure context).

1. Enter an alias, add a browser-reachable bootstrap address, and optionally add
   room names. Click **Create**, then **Connect**.
2. Join the same room name on another client to start a group chat. Room names
   are case-sensitive. **Load older messages** requests the previous history page.
3. For a direct message, copy the recipient's peer ID from their chat screen,
   paste it into **Recipient peer ID**, and open the conversation. Both clients
   must be online and reachable to send a DM.
4. **Disconnect** returns to identity settings. After a page reload, click
   **Connect** to reopen the same identity and local history.

Use separate browser profiles or private browsing contexts to test different
identities. Tabs on the same origin share the saved identity.

## Reference server (`../tce`)

Run `go run ./src -config /path/to/config.json` from `../tce`. The first run creates
a configuration and identity. Stop the server, then set, for example:

```json
{
  "rooms": ["general"],
  "defaultConfig": {
    "saveMessages": true,
    "saveAttachments": false,
    "saveMedia": false
  }
}
```

Keep the generated `identity`, `datastore`, and `listenAddrs` fields, then restart.
The server logs its peer ID. For the default local WebSocket listener, add this
bootstrap address to each browser:

```text
/ip4/127.0.0.1/tcp/8802/ws/p2p/<server-peer-id>
```

For remote deployments, use a reachable WebSocket address; an HTTPS client needs
a secure WebSocket (`wss`) endpoint. The reference server now provides relay
reservations so browsers can establish direct-message streams through it.

## Persistence and backups

- IndexedDB stores group-message metadata, content blocks, incoming/outgoing DMs,
  and DM contacts. Each identity has its own database.
- Group messages are saved locally before publishing. Pending messages retry
  while connected, including after reconnecting. “Sent” means published to
  GossipSub, rather than an acknowledgment from every participant.
- DMs carry the sender's alias, original send time, and text in one CBOR payload
  per stream. Successful outgoing sends and incoming messages are stored locally.
  Failed sends retain the draft for retry. Every message displays its sender and
  local date/time; the full timestamp is available on hover.
- Leaving a room retains its local history. Clearing the site's browser data
  removes the saved identity and messages.
- **Identity / backup → Export identity and messages** downloads a `.identity`
  file containing settings, the private identity key, and the full local database.
  **Load** (for a new profile) or **Import identity and messages** (while
  disconnected) restores it. Import replaces the database for the imported
  identity; keep the file private because it contains the identity key.

## Protocol

Room names are GossipSub topics. Requests use the reference's CBOR map fields:

```text
Get:      { type: 0, timestamp: <exclusive Unix milliseconds>, messages: null }
Messages: { type: 1, timestamp: 0, messages: [
  { timestamp, name, content: { type: 0, cid: <raw CID bytes> } }
] }
```

Text content is UTF-8 in SHA-256-addressed raw blocks. Blocks are announced through
`/thetachat/kad/1.0.0` and exchanged using `/thetachat/swap/1.0.0`; received bytes
are verified against the requested CID. History responses are scoped to the
requested room and contain up to ten messages. DMs prefer
`/thetachat/dm/2.0.0`, carrying `{ name, timestamp, content }` as CBOR. Clients also
accept and negotiate the original `/thetachat/dm/1.0.0` UTF-8 stream protocol.
Legacy incoming messages without an alias show the sender's peer ID and their
local receive time; older outgoing history falls back to your current alias.
Attachment/media metadata is recognized;
this UI currently sends text messages.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

Reference checks, from `../tce`:

```sh
go test -race ./...
```

Tests cover protocol decoding, fragmented DM streams, swap integrity, database
isolation, persistence, and atomic backup restoration. Live Chromium checks were
also run with multiple clients and `tce`, including group/DM delivery, reloads,
backup import/export, and history recovery while the original senders were offline.
