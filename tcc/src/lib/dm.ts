import { Connection, DialTarget, Libp2p, Stream } from "@libp2p/interface";
import { IDBPDatabase } from "idb";
import { v4 } from "uuid";
import { Uint8ArrayList } from "uint8arraylist";
import { MAX_MESSAGE_SIZE } from "./proto";
import { decode, encode } from "cbor2";

export const DM_PROTOCOL = "/thetachat/dm/2.0.0";
export const LEGACY_DM_PROTOCOL = "/thetachat/dm/1.0.0";

export interface Message {
  id: string;
  userId: string;
  content: string;
  timestamp: number;
  direction?: "incoming" | "outgoing";
  name?: string;
}

type MessagePayload = { name: string; timestamp: number; content: string };

function validatePayload(payload: MessagePayload) {
  if (!payload || typeof payload.name !== "string" || !payload.name.trim() ||
      typeof payload.content !== "string" || !payload.content.trim() ||
      !Number.isSafeInteger(payload.timestamp) || payload.timestamp < 0 || payload.timestamp > 8.64e15) {
    throw new Error("Invalid direct message");
  }
  return payload;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function dmHandler(
  db: IDBPDatabase,
  callback: (dm: Message) => void
) {
  return async (stream: Stream, connection: Connection) => {
    const userId = connection.remotePeer.toString();
    const timer = setTimeout(() => stream.abort(new Error("Direct message timed out")), 30_000);

    try {
      const buffer = new Uint8ArrayList();
      for await (const chunk of stream) {
        buffer.append(chunk);
        if (buffer.byteLength > MAX_MESSAGE_SIZE) throw new Error("Direct message too large");
      }
      const bytes = buffer.subarray();
      const payload = stream.protocol === DM_PROTOCOL && bytes.byteLength > 0
        ? validatePayload(decode<MessagePayload>(bytes))
        : undefined;
      const content = payload?.content ?? decoder.decode(bytes);
      if (content.length > 0) {
        const msg: Message = {
          id: v4(),
          userId,
          content,
          timestamp: payload?.timestamp ?? Date.now(),
          direction: "incoming",
          ...(payload && { name: payload.name }),
        };

        const tx = db.transaction("dms", "readwrite");

        await tx.objectStore("dms").add(msg);
        await tx.done;

        callback(msg);
      }
    } finally {
      clearTimeout(timer);
      await stream.close();
    }
  };
}

export async function sendDm(
  libp2p: Libp2p,
  peer: DialTarget,
  content: string,
  signal: AbortSignal,
  metadata: { name: string; timestamp: number }
) {
  const payload = validatePayload({ ...metadata, content });
  const encoded = encode(payload);
  if (encoded.byteLength > MAX_MESSAGE_SIZE) throw new Error("Direct message too large");
  const stream = await libp2p.dialProtocol(
    peer,
    [DM_PROTOCOL, LEGACY_DM_PROTOCOL],
    { signal }
  );

  try {
    const bytes = stream.protocol === DM_PROTOCOL ? encoded : encoder.encode(content);
    if (!stream.send(bytes)) await stream.onDrain({ signal });
  } finally {
    await stream.close({ signal });
  }
}
