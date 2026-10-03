import { decode, encode } from "cbor2";
import { type IDBPDatabase, openDB } from "idb";
import { CID } from "multiformats/cid";
import type { Message } from "./proto";

export interface RoomMessage extends Message {
  id: string;
  room: string;
  text?: string;
  status?: "pending" | "sent";
}

const stores = ["meta", "blocks", "dms", "messages"] as const;

export async function open(identity?: string) {
  return openDB(identity ? `ThetaChat-Database-${identity}` : "ThetaChat-Database", 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      if (!db.objectStoreNames.contains("blocks")) db.createObjectStore("blocks");
      if (!db.objectStoreNames.contains("dms")) {
        const dms = db.createObjectStore("dms", { keyPath: "id" });
        dms.createIndex("userId", "userId");
      }
      if (!db.objectStoreNames.contains("messages")) {
        const messages = db.createObjectStore("messages", { keyPath: "id" });
        messages.createIndex("room", "room");
      }
    },
  });
}

export async function cids(db: IDBPDatabase) {
  return (await db.getAllKeys("blocks")).map(key => CID.parse(String(key)));
}

export async function roomMessages(db: IDBPDatabase, room: string): Promise<RoomMessage[]> {
  const messages = await db.getAllFromIndex("messages", "room", room);
  return messages.sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
}

export function messageId(room: string, msg: Message) {
  return JSON.stringify([room, msg.timestamp, msg.name, msg.content.type, CID.decode(msg.content.cid).toString()]);
}

export async function save(db: IDBPDatabase) {
  const data: Record<string, Record<string, unknown>> = {};
  const tx = db.transaction([...stores], "readonly");
  for (const name of stores) {
    const store = tx.objectStore(name);
    const keys = await store.getAllKeys();
    const values = await store.getAll();
    data[name] = Object.fromEntries(keys.map((key, i) => [String(key), values[i]]));
  }
  await tx.done;
  return encode(data);
}

export async function load(db: IDBPDatabase, bytes: Uint8Array) {
  const data = decode<Record<string, Record<string, unknown>>>(bytes);
  if (!data || typeof data !== "object") throw new Error("Invalid database export");
  for (const name of stores) {
    if (name === "messages" && data[name] === undefined) continue; // Older exports.
    if (!data[name] || typeof data[name] !== "object" || Array.isArray(data[name])) {
      throw new Error("Invalid database export");
    }
  }
  const tx = db.transaction([...stores], "readwrite");
  try {
    for (const name of stores) {
      const store = tx.objectStore(name);
      await store.clear();
      for (const [key, value] of Object.entries(data[name] ?? {})) {
        if (store.keyPath) await store.put(value);
        else await store.put(value, key);
      }
    }
    await tx.done;
  } catch (error) {
    tx.abort();
    await tx.done.catch(() => {});
    throw error;
  }
}
