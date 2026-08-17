import { generateKeyPair, privateKeyFromRaw } from "@libp2p/crypto/keys";
import { decode, encode } from "cbor2";
import { Network } from "./net";

export class Save {
  private identity: Uint8Array;
  alias: string;
  bootstrap: string[];
  rooms: string[];
  database?: Uint8Array;

  constructor(identity: Uint8Array, alias: string, bootstrap: string[], rooms: string[], database?: Uint8Array) {
    this.identity = identity;
    this.alias = alias;
    this.bootstrap = bootstrap;
    this.rooms = rooms;

    if (database) {
      this.database = database;
    }
  }

  keypair() {
    return privateKeyFromRaw(this.identity);
  }

  async encode(network?: Network) {
    if (network) {
      this.database = await network.exportDatabase();
    }
    
    return encode(this);
  }
}

export async function createSave(alias: string, bootstrap: string[], rooms: string[]) {
  const identity = await generateKeyPair("Ed25519");

  return new Save(identity.raw, alias, bootstrap, rooms);
}

export function loadSave(data: Uint8Array) {
  return decode<Save>(data);
}
