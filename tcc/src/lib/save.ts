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

function setStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function getStorage<T>(key: string): T | null {
  const value = localStorage.getItem(key);

  return value ? JSON.parse(value) as T : null;
}

export async function loadSave() {
  const identity = getStorage<Uint8Array>("identity");
  const alias = getStorage<string>("alias");
  const bootstrap = getStorage<string[]>("bootstrap");
  const rooms = getStorage<string[]>("rooms");

  if (identity && alias && bootstrap && rooms) {
    return new Save(identity, alias, bootstrap, rooms);
  } else {
    return null;
  }
}

export async function createSave(alias: string, bootstrap: string[], rooms: string[]) {
  const identity = await generateKeyPair("Ed25519");

  setStorage("identity", identity.raw);
  setStorage("alias", alias);
  setStorage("bootstrap", bootstrap);
  setStorage("rooms", rooms);

  return new Save(identity.raw, alias, bootstrap, rooms);
}

export function importSave(data: Uint8Array) {
  const save = decode<Save>(data);

  setStorage("identity", save.keypair().raw);
  setStorage("alias", save.alias);
  setStorage("bootstrap", save.bootstrap);
  setStorage("rooms", save.rooms);

  return save;
}
