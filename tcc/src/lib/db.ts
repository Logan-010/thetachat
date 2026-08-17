import { decode, encode } from "cbor2";
import { IDBPDatabase, openDB } from "idb";

type KVData = Record<string, unknown>;

export async function open() {
  const db = await openDB("ThetaChat-Database", 1, {
    upgrade(db) {
      db.createObjectStore("kv");
    },
  });

  return db;
}

export async function save(db: IDBPDatabase): Promise<Uint8Array> {
  const tx = db.transaction("kv", "readonly");
  const store = tx.objectStore("kv");

  const keys = await store.getAllKeys();
  const values = await store.getAll();

  const data: KVData = {};

  for (let i = 0; i < keys.length; i++) {
    data[String(keys[i])] = values[i];
  }

  return encode(data);
}

export async function load(
  db: IDBPDatabase,
  cborData: Uint8Array,
): Promise<void> {
  const decoded: unknown = decode(cborData);

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    Array.isArray(decoded)
  ) {
    throw new Error("Invalid database export");
  }

  const data = decoded as Record<string, unknown>;

  const tx = db.transaction("kv", "readwrite");
  const store = tx.objectStore("kv");

  await store.clear();

  for (const [key, value] of Object.entries(data)) {
    await store.put(value, key);
  }

  await tx.done;
}

