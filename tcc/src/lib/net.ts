import { createLibp2p, Libp2p } from "libp2p";
import { Save } from "./save";
import { webSockets } from "@libp2p/websockets";
import { webRTC } from "@libp2p/webrtc";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify } from "@libp2p/identify";
import { kadDHT, removePrivateAddressesMapper } from "@libp2p/kad-dht";
import { gossipsub } from "@libp2p/gossipsub";
import { ping } from "@libp2p/ping";
import { IDBPDatabase } from "idb";
import { cids, open, save } from "./db";
import { bootstrap } from "@libp2p/bootstrap";
import { SWAP_PROTOCOL } from "./proto";
import { swapHandler } from "./swap";
import { DM_PROTOCOL, dmHandler, Message, sendDm } from "./dm";
import { peerIdFromString } from "@libp2p/peer-id";

export class Network {
  private node: Libp2p;
  private db: IDBPDatabase;

  constructor(node: Libp2p, db: IDBPDatabase) {
    this.node = node;
    this.db = db;
  }

  async handleDms(callback: (msg: Message) => void) {
    await this.node.handle(DM_PROTOCOL, dmHandler(this.db, callback));
  }

  async dm(to: string, content: string) {
    const id = peerIdFromString(to);

    await sendDm(this.node, id, content, AbortSignal.timeout(10_000));
  }

  async exportDatabase() {
    const data = await save(this.db);

    return data;
  }
}

export async function createNetwork(save: Save) {
  const db = await open();

  const node = await createLibp2p({
    privateKey: await save.keypair(),
    peerDiscovery:
      save.bootstrap.length > 0
        ? [
          bootstrap({
            list: save.bootstrap,
          }),
        ]
        : [],
    addresses: {
      listen: ["/p2p-circuit", "/webrtc"],
    },
    transports: [webSockets(), webRTC(), circuitRelayTransport()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    connectionGater: {
      denyDialMultiaddr: () => false,
    },
    services: {
      identify: identify(),
      dht: kadDHT({
        protocol: "/thetachat/kad/1.0.0",
        peerInfoMapper: removePrivateAddressesMapper,
        clientMode: false,
      }),
      ping: ping(),
      gossipsub: gossipsub(),
    },
  });

  console.log("starting node");

  await node.start();

  await node.services.dht.refreshRoutingTable();

  node.addEventListener("peer:connect", (event) => {
    console.log("connected to", event.detail.toString());
  });

  node.addEventListener("peer:discovery", (event) => {
    console.log("discovered", event.detail.id.toString());
  });

  await node.handle(SWAP_PROTOCOL, swapHandler(db));

  for (let cid of await cids(db)) {
    node.services.dht.provide(cid);
  }

  return new Network(node, db);
}
