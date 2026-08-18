function uint8ArrayToBase64(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data));
}

function base64ToUint8Array(data: string): Uint8Array {
  return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
}

export class Save {
  identity: Uint8Array;
  alias: string;
  bootstrap: string[];
  rooms: string[];
  database?: Uint8Array;

  constructor(
    identity: Uint8Array,
    alias: string,
    bootstrap: string[],
    rooms: string[],
    database?: Uint8Array,
  ) {
    this.identity = identity;
    this.alias = alias;
    this.bootstrap = bootstrap;
    this.rooms = rooms;
    this.database = database;
  }

  async keypair() {
    const { privateKeyFromRaw } = await import("@libp2p/crypto/keys");

    return privateKeyFromRaw(this.identity);
  }

  async encode(database?: Uint8Array) {
    if (database) {
      this.database = database;
    }

    const { encode } = await import("cbor2");

    return encode({
      identity: this.identity,
      alias: this.alias,
      bootstrap: this.bootstrap,
      rooms: this.rooms,
      database: this.database,
    });
  }
}

export function setStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getStorage<T>(key: string): T | null {
  const value = localStorage.getItem(key);

  return value ? (JSON.parse(value) as T) : null;
}

export async function loadSave() {
  const identity = getStorage<string>("identity");
  const alias = getStorage<string>("alias");
  const bootstrap = getStorage<string[]>("bootstrap");
  const rooms = getStorage<string[]>("rooms");

  if (identity && alias && bootstrap && rooms) {
    return new Save(base64ToUint8Array(identity), alias, bootstrap, rooms);
  }

  return null;
}

export async function createSave(
  alias: string,
  bootstrap: string[],
  rooms: string[],
) {
  const { generateKeyPair } = await import("@libp2p/crypto/keys");

  const identity = await generateKeyPair("Ed25519");

  setStorage("identity", uint8ArrayToBase64(identity.raw));
  setStorage("alias", alias);
  setStorage("bootstrap", bootstrap);
  setStorage("rooms", rooms);

  return new Save(identity.raw, alias, bootstrap, rooms);
}

export async function importSave(data: Uint8Array) {
  const { decode } = await import("cbor2");

  const value = decode<Save>(data);

  const save = new Save(
    value.identity,
    value.alias,
    value.bootstrap,
    value.rooms,
    value.database,
  );

  const keypair = await save.keypair();

  setStorage("identity", uint8ArrayToBase64(keypair.raw));
  setStorage("alias", save.alias);
  setStorage("bootstrap", save.bootstrap);
  setStorage("rooms", save.rooms);

  return save;
}
