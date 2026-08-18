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
import { PROTOCOL } from "./proto";
import { createHandler } from "./swap";

export class Network {
  private node: Libp2p;
  private db: IDBPDatabase;

  constructor(node: Libp2p, db: IDBPDatabase) {
    this.node = node;
    this.db = db;
  }

  async exportDatabase() {
    const data = await save(this.db);

    return data;
  }
}

export async function createNetwork(save: Save) {
  const db = await open();

  const node = await createLibp2p({
    privateKey: save.keypair(),
    peerDiscovery: [
      bootstrap({
        list: save.bootstrap
      })
    ],
    addresses: {
      listen: [
        '/p2p-circuit',
        '/webrtc'
      ]
    },
    transports: [
      webSockets(),
      webRTC(),
      circuitRelayTransport()
    ],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    connectionGater: {
      denyDialMultiaddr: () => false
    },
    services: {
      identify: identify(),
      aminoDHT: kadDHT({
        protocol: '/thetachat/kad/1.0.0',
        peerInfoMapper: removePrivateAddressesMapper
      }),
      ping: ping(),
      gossipsub: gossipsub(),
    }
  });
  await node.start();

  await node.handle(PROTOCOL, createHandler(db));

  for (const cid of await cids(db)) {
    node.services.aminoDHT.provide(cid);
  }

  return new Network(node, db);
}
