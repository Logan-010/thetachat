# θchat Specification

## Relays

A _relay_ is simply a LibP2P Node listening on a WebSocket that supports the following protocols:

- Ping (/ipfs/ping/1.0.0)
- Circuit Relay v2 (/libp2p/circuit/relay/0.2.0/hop & /libp2p/circuit/relay/0.2.0/stop)
- Kademlia (/ipfs/kad/1.0.0)
- Identify (/ipfs/id/1.0.0 & /ipfs/id/pus/1.0.0)

## θcreep(s)

A _θcreep_ is a read-only client.

Implementations may differ, but typically a _θcreep_ joins a room and listens for messages, attachments, etc. from specific (or all) users. The θcreep then saves the messages and acts as a normal client in the room - sharing messages when asked and preserving message history.

## Clients

TODO!
