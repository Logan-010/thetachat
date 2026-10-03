import { Connection, DialTarget, Libp2p, Stream } from "@libp2p/interface";
import { IDBPDatabase } from "idb";
import { v4 } from "uuid";
import { Uint8ArrayList } from "uint8arraylist";
import { MAX_MESSAGE_SIZE } from "./proto";

export const DM_PROTOCOL = "/thetachat/dm/1.0.0";

export interface Message {
  id: string;
  userId: string;
  content: string;
  timestamp: number;
  direction?: "incoming" | "outgoing";
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
      const content = decoder.decode(buffer.subarray());
      if (content.length > 0) {
        const msg: Message = {
          id: v4(),
          userId,
          content,
          timestamp: Date.now(),
          direction: "incoming",
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
  signal: AbortSignal
) {
  const bytes = encoder.encode(content);
  if (bytes.byteLength > MAX_MESSAGE_SIZE) throw new Error("Direct message too large");
  const stream = await libp2p.dialProtocol(
    peer,
    DM_PROTOCOL,
    { signal }
  );

  try {
    if (!stream.send(bytes)) await stream.onDrain({ signal });
  } finally {
    await stream.close({ signal });
  }
}
