import { createLibp2p } from "libp2p";
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
import { createBitswap } from "ipfs-bitswap";
import { MemoryBlockstore } from "blockstore-core";

export async function init(save: Save) {
  const node = await createLibp2p({
    privateKey: save.keypair(),
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

  const blockstore = new MemoryBlockstore();

  const bitswap = createBitswap(node as any, blockstore as any);

  await bitswap.start();

}
