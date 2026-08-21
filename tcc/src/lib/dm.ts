import { Connection, DialTarget, Libp2p, Stream } from "@libp2p/interface";
import { IDBPDatabase } from "idb";
import { v4 } from "uuid";

export const DM_PROTOCOL = "/thetachat/dm/1.0.0";

export interface Message {
  id: string;
  userId: string;
  content: string;
  timestamp: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function dmHandler(
  db: IDBPDatabase,
  callback: (dm: Message) => void
) {
  return async (stream: Stream, connection: Connection) => {
    const userId = connection.remotePeer.toString();

    try {
      for await (const chunk of stream) {
        const content = decoder.decode(chunk as Uint8Array);

        const msg: Message = {
          id: v4(),
          userId,
          content,
          timestamp: Date.now(),
        };

        const tx = db.transaction("dms", "readwrite");

        await tx.objectStore("dms").add(msg);
        await tx.done;

        callback(msg);
      }
    } finally {
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
  const stream = await libp2p.dialProtocol(
    peer,
    DM_PROTOCOL,
    { signal }
  );

  try {
    stream.send(encoder.encode(content));
  } finally {
    await stream.close();
  }
}

