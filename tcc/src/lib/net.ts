import { createLibp2p } from "libp2p";
import { Save, setStorage } from "./save";
import { webSockets } from "@libp2p/websockets";
import { webRTC } from "@libp2p/webrtc";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify } from "@libp2p/identify";
import { kadDHT, passthroughMapper } from "@libp2p/kad-dht";
import { gossipsub } from "@libp2p/gossipsub";
import { ping } from "@libp2p/ping";
import type { IDBPDatabase } from "idb";
import { cids, open, save as exportDb, load, roomMessages, messageId, type RoomMessage } from "./db";
import { bootstrap } from "@libp2p/bootstrap";
import { SWAP_PROTOCOL, decodeRequest, encodeRequest, MAX_MESSAGE_SIZE, type Message } from "./proto";
import { getBlock, swapHandler } from "./swap";
import { DM_PROTOCOL, dmHandler, type Message as DirectMessage, sendDm } from "./dm";
import { peerIdFromString } from "@libp2p/peer-id";
import type { PeerId } from "@libp2p/interface";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";

async function makeNode(profile: Save) {
  return createLibp2p({
    start: false,
    privateKey: await profile.keypair(),
    peerDiscovery: profile.bootstrap.length ? [bootstrap({ list: profile.bootstrap })] : [],
    addresses: { listen: ["/p2p-circuit", "/webrtc"] },
    transports: [webSockets(), webRTC(), circuitRelayTransport()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    connectionGater: { denyDialMultiaddr: () => false },
    services: {
      identify: identify(),
      dht: kadDHT({ protocol: "/thetachat/kad/1.0.0", clientMode: true, peerInfoMapper: passthroughMapper }),
      ping: ping(),
      gossipsub: gossipsub({ runOnLimitedConnection: true }),
    },
  });
}

type Node = Awaited<ReturnType<typeof makeNode>>;

export class Network {
  private listeners = new Set<() => void>();
  private stopped = false;
  private timer?: ReturnType<typeof setInterval>;
  private syncRunning = false;
  private receiving = new Map<string, Promise<void>>();
  private announced = new Set<string>();
  private lastTimestamp = 0;
  error = "";

  constructor(private node: Node, private db: IDBPDatabase, private profile: Save) {}

  get id() { return this.node.peerId.toString(); }
  get rooms() { return [...this.profile.rooms]; }
  get peers() { return this.node.getPeers().map(peer => peer.toString()); }

  subscribe(callback: () => void) {
    this.listeners.add(callback);
    return () => { this.listeners.delete(callback); };
  }

  private changed() { for (const callback of this.listeners) callback(); }
  private report(error: unknown) {
    if (this.stopped) return;
    this.error = error instanceof Error ? error.message : String(error);
    this.changed();
  }

  async start() {
    await this.node.handle(SWAP_PROTOCOL, swapHandler(this.db), { runOnLimitedConnection: true });
    await this.node.handle(DM_PROTOCOL, dmHandler(this.db, () => this.changed()), { runOnLimitedConnection: true });
    this.node.services.gossipsub.addEventListener("message", event => {
      const msg = event.detail;
      if (msg.type !== "signed" || !this.profile.rooms.includes(msg.topic)) return;
      void this.receive(msg.topic, msg.data, msg.from).catch(error => this.report(error));
    });
    this.node.addEventListener("peer:connect", () => {
      this.changed();
      void this.sync();
    });
    this.node.addEventListener("peer:disconnect", () => this.changed());
    await this.node.start();
    for (const room of this.rooms) this.node.services.gossipsub.subscribe(room);
    // Retry discovery, history requests and unsent messages as peers become available.
    this.timer = setInterval(() => { void this.sync(); }, 30_000);
    void this.sync();
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.timer);
    try { await this.node.stop(); } finally { this.db.close(); }
  }

  async joinRoom(name: string) {
    const room = name.trim();
    if (!room) throw new Error("Enter a room name");
    if (this.rooms.includes(room)) return;
    this.node.services.gossipsub.subscribe(room);
    this.profile.rooms.push(room);
    setStorage("rooms", this.profile.rooms);
    this.changed();
    void this.sync();
  }

  async leaveRoom(room: string) {
    this.node.services.gossipsub.unsubscribe(room);
    this.profile.rooms = this.rooms.filter(name => name !== room);
    setStorage("rooms", this.profile.rooms);
    this.changed();
  }

  messages(room: string) { return roomMessages(this.db, room); }
  async directMessages(peer: string): Promise<DirectMessage[]> {
    const messages = await this.db.getAllFromIndex("dms", "userId", peer);
    return messages.sort((a, b) => a.timestamp - b.timestamp);
  }
  async contacts(): Promise<string[]> {
    const messages: DirectMessage[] = await this.db.getAll("dms");
    const contacts: string[] = await this.db.get("meta", "contacts") ?? [];
    return [...new Set([...contacts, ...messages.map(msg => msg.userId)])];
  }
  async addContact(peer: string) {
    const id = peerIdFromString(peer.trim()).toString();
    if (id === this.id) throw new Error("Choose another peer for a direct message");
    await this.db.put("meta", [...new Set([...await this.contacts(), id])], "contacts");
    this.changed();
    return id;
  }

  async dm(to: string, content: string) {
    if (!content.trim()) throw new Error("Enter a message");
    await sendDm(this.node, peerIdFromString(to), content, AbortSignal.timeout(15_000));
    await this.db.put("dms", {
      id: crypto.randomUUID(), userId: to, content, timestamp: Date.now(), direction: "outgoing",
    } satisfies DirectMessage);
    this.changed();
  }

  async sendRoom(room: string, text: string) {
    if (!this.rooms.includes(room)) throw new Error("Join the room first");
    const bytes = new TextEncoder().encode(text);
    if (!text.trim() || bytes.byteLength > MAX_MESSAGE_SIZE) throw new Error("Enter a message of at most 1 MiB");
    const cid = CID.createV1(0x55, await sha256.digest(bytes));
    this.lastTimestamp = Math.max(Date.now(), this.lastTimestamp + 1);
    const message: Message = { timestamp: this.lastTimestamp, name: this.profile.alias, content: { type: 0, cid: cid.bytes } };
    const record: RoomMessage = { ...message, id: messageId(room, message), room, text, status: "pending" };
    const tx = this.db.transaction(["messages", "blocks"], "readwrite");
    await tx.objectStore("blocks").put(bytes, cid.toString());
    await tx.objectStore("messages").put(record);
    await tx.done;
    this.changed();
    try { await this.publishRecord(record); } catch (error) { this.report(error); }
  }

  private async publishRecord(record: RoomMessage) {
    const cid = CID.decode(record.content.cid);
    // A tce node finds message blocks through the DHT, so announce before publishing.
    await this.announce(cid);
    await this.node.services.gossipsub.publish(record.room, encodeRequest({ type: 1, timestamp: 0, messages: [this.wire(record)] }));
    await this.db.put("messages", { ...record, status: "sent" });
    this.error = "";
    this.changed();
  }

  private wire(msg: Message): Message {
    return { timestamp: msg.timestamp, name: msg.name, content: msg.content };
  }

  async requestHistory(room: string, before = Date.now() + 1) {
    await this.node.services.gossipsub.publish(room, encodeRequest({ type: 0, timestamp: before, messages: null }));
  }

  private async receive(room: string, data: Uint8Array, from: PeerId) {
    const request = decodeRequest(data);
    if (request.type === 0) {
      const messages = (await this.messages(room)).filter(msg => msg.timestamp < request.timestamp && msg.status !== "pending").slice(-10);
      if (messages.length) await this.node.services.gossipsub.publish(room,
        encodeRequest({ type: 1, timestamp: 0, messages: messages.map(msg => this.wire(msg)) }));
      return;
    }
    for (const message of request.messages ?? []) {
      const id = messageId(room, message);
      if (this.receiving.has(id)) { await this.receiving.get(id); continue; }
      const task = this.receiveMessage(room, message, from);
      this.receiving.set(id, task);
      try { await task; } catch (error) { this.report(error); }
      finally { this.receiving.delete(id); }
    }
  }

  private async receiveMessage(room: string, message: Message, from: PeerId) {
    const id = messageId(room, message);
    const existing: RoomMessage | undefined = await this.db.get("messages", id);
    if (existing?.text !== undefined) return;
    const record: RoomMessage = { ...message, id, room };
    await this.db.put("messages", existing ?? record);
    this.changed();
    if (message.content.type !== 0) return;
    const cid = CID.decode(message.content.cid);
    let bytes: Uint8Array | undefined = await this.db.get("blocks", cid.toString());
    if (!bytes) {
      try { bytes = await getBlock(this.node, from, cid, AbortSignal.timeout(10_000)); } catch {
        for await (const provider of this.node.contentRouting.findProviders(cid, { signal: AbortSignal.timeout(20_000) })) {
          if (provider.id.equals(this.node.peerId)) continue;
          await this.node.peerStore.merge(provider.id, { multiaddrs: provider.multiaddrs });
          try { bytes = await getBlock(this.node, provider.id, cid, AbortSignal.timeout(10_000)); break; } catch { /* Try the next provider. */ }
        }
      }
    }
    if (!bytes) throw new Error(`Message content unavailable: ${cid}`);
    const tx = this.db.transaction(["blocks", "messages"], "readwrite");
    await tx.objectStore("blocks").put(bytes, cid.toString());
    await tx.objectStore("messages").put({ ...record, text: new TextDecoder().decode(bytes) });
    await tx.done;
    this.changed();
    void this.announce(cid).catch(error => this.report(error));
  }

  private async announce(cid: CID) {
    if (this.announced.has(cid.toString())) return;
    await this.node.contentRouting.provide(cid, { signal: AbortSignal.timeout(10_000) });
    this.announced.add(cid.toString());
  }

  private async discover(room: string) {
    const cid = CID.createV1(0x55, await sha256.digest(new TextEncoder().encode(room)));
    await this.node.contentRouting.provide(cid, { signal: AbortSignal.timeout(10_000) });
    for await (const provider of this.node.contentRouting.findProviders(cid, { signal: AbortSignal.timeout(10_000) })) {
      if (provider.id.equals(this.node.peerId)) continue;
      await this.node.peerStore.merge(provider.id, { multiaddrs: provider.multiaddrs });
      try { await this.node.dial(provider.id, { signal: AbortSignal.timeout(10_000) }); } catch { /* Other providers may be reachable. */ }
    }
  }

  async sync() {
    if (this.syncRunning || this.stopped) return;
    this.syncRunning = true;
    try {
      for (const room of this.rooms) {
        try { await this.discover(room); } catch { /* Offline rooms still have local history. */ }
        if (this.stopped) return;
        try {
          for (const msg of await this.messages(room)) if (msg.status === "pending") await this.publishRecord(msg);
          await this.requestHistory(room);
        } catch { /* Retry after gossip subscriptions propagate. */ }
      }
      if (this.stopped) return;
      for (const cid of await cids(this.db)) {
        if (this.stopped) return;
        try { await this.announce(cid); } catch { break; }
      }
    } catch (error) { this.report(error); }
    finally { this.syncRunning = false; }
  }

  exportDatabase() { return exportDb(this.db); }
}

export async function createNetwork(profile: Save) {
  const { peerIdFromPrivateKey } = await import("@libp2p/peer-id");
  const identity = peerIdFromPrivateKey(await profile.keypair()).toString();
  const db = await open(identity);
  let network: Network | undefined;
  try {
    if (profile.database) { await load(db, profile.database); profile.database = undefined; }
    network = new Network(await makeNode(profile), db, profile);
    await network.start();
    return network;
  } catch (error) {
    if (network) await network.stop();
    else db.close();
    throw error;
  }
}
