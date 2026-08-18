import { decode, encode } from "cbor2";
import { IDBPDatabase, openDB } from "idb";
import { CID } from "multiformats";

type ExportedDatabase = {
  meta: Record<string, unknown>;
  blocks: Record<string, unknown>;
};

export async function open() {
  const db = await openDB("ThetaChat-Database", 1, {
    upgrade(db) {
      db.createObjectStore("meta");
      db.createObjectStore("blocks");
    },
  });

  return db;
}

export async function cids(db: IDBPDatabase) {
  const tx = db.transaction("blocks", "readonly");
  const store = tx.objectStore("blocks");
  const keys = await store.getAllKeys();

  let cids: CID[] = [];

  for (let i = 0; i < keys.length; i++) {
    const cidstr = keys[i];

    cids.push(CID.parse(cidstr.toString()));
  }

  return cids;
}

export async function save(db: IDBPDatabase) {
  const data: ExportedDatabase = {
    meta: {},
    blocks: {},
  };

  {
    const tx = db.transaction("meta", "readonly");
    const store = tx.objectStore("meta");

    const keys = await store.getAllKeys();
    const values = await store.getAll();

    for (let i = 0; i < keys.length; i++) {
      data.meta[String(keys[i])] = values[i];
    }
  }

  {
    const tx = db.transaction("blocks", "readonly");
    const store = tx.objectStore("blocks");

    const keys = await store.getAllKeys();
    const values = await store.getAll();

    for (let i = 0; i < keys.length; i++) {
      data.blocks[String(keys[i])] = values[i];
    }
  }

  return encode(data);
}

export async function load(db: IDBPDatabase, cborData: Uint8Array) {
  const decoded: ExportedDatabase = decode(cborData);

  if (
    typeof decoded.meta !== "object" ||
    decoded.meta === null ||
    Array.isArray(decoded.meta) ||
    typeof decoded.blocks !== "object" ||
    decoded.blocks === null ||
    Array.isArray(decoded.blocks)
  ) {
    throw new Error("Invalid database export");
  }

  {
    const data = decoded.meta as Record<string, unknown>;

    const tx = db.transaction("meta", "readwrite");
    const store = tx.objectStore("meta");

    await store.clear();

    for (const [key, value] of Object.entries(data)) {
      await store.put(value, key);
    }

    await tx.done;
  }

  {
    const data = decoded.blocks as Record<string, unknown>;

    const tx = db.transaction("blocks", "readwrite");
    const store = tx.objectStore("blocks");

    await store.clear();

    for (const [key, value] of Object.entries(data)) {
      await store.put(value, key);
    }

    await tx.done;
  }
}
