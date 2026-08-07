# Q & A

## What is θchat/thetachat?

θchat is not a traditional chat protocol. It is not like Matrix, or IRC. There is no central server, there is no stored data, there is only clients. Don't be deceived, the θchat relay service does not actually hold any client data, it simply is a relay to allow clients to hole punch connections and a rendezvous service that allows clients to discover each others peer ids.

## Why is a relay even needed?

Well unfortunately, NAT and firewalls exist. Because of this clients need a relay to hole-punch a direct connection. All data sent to/from the relay is encrypted and cannot be seen by the relay, additionally the relay is only used for establishing connections, not actual connections over the relay.

A secondary function of the relay is client discovery. Instead of needing to know a client's peer id to connect to them (or for a room, many peer ids) the client can ask the server for known peers.

## If the relays store no data, how are my messages saved?

That's the thing that separates θchat from other messaging protocols, they're _not_ saved - or at least by default. If a user joins a chatroom and there aren't any other currently connected users that have the old messages, the new user can't see the old messages. New messages are saved on all clients, and clients share which messages they have loaded so users can reconstruct message history.

However, included in the repo is a **θcreep** which acts as a client that only saves messages. This service stays online on a server and saves new messages from clients, which then allows clients to retrieve old messages without peers online that already know the messages. Really, the **θcreep** is a read only client that stays online at all times.
