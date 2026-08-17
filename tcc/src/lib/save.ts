import { generateKeyPair, privateKeyFromRaw } from "@libp2p/crypto/keys";
import { decode, encode } from "cbor2";

export class Save {
  private identity: Uint8Array;
  alias: string;
  bootstrap: string[];
  rooms: string[];

  constructor(identity: Uint8Array, alias: string, bootstrap: string[], rooms: string[]) {
    this.identity = identity;
    this.alias = alias;
    this.bootstrap = bootstrap;
    this.rooms = rooms;
  }


  keypair() {
    return privateKeyFromRaw(this.identity);
  }

  encode() {
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
