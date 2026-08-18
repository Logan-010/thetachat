import { Connection, DialTarget, Libp2p, Stream } from "@libp2p/interface";
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import { PROTOCOL } from "./proto";
import { Uint8ArrayList } from "uint8arraylist";
import { IDBPDatabase } from "idb";

const MAX_BLOCK_SIZE = 64 << 20;
const MAX_CID_SIZE = 1024;

async function readCID(stream: Stream): Promise<CID> {
  const buffer = new Uint8ArrayList();

  for await (const chunk of stream) {
    buffer.append(chunk);

    if (buffer.byteLength > MAX_CID_SIZE) {
      throw new Error("CID exceeds maximum size");
    }

    const bytes = buffer.subarray();

    try {
      const cid = CID.decode(bytes);

      return cid;
    } catch {
    }
  }

  throw new Error("unexpected EOF while reading CID");
}

export function createHandler(db: IDBPDatabase) {
  return async (stream: Stream, connection: Connection) => {
    try {
      const requestedCID = await readCID(stream);

      console.log(
        `Swap request for ${requestedCID} from ${connection.remotePeer}`
      );

      const block = await db.get(
        "blocks",
        requestedCID.toString()
      ) as Uint8Array | undefined;

      if (block == null) {
        console.error(`Block not found: ${requestedCID}`);
        return;
      }

      if (block.byteLength > MAX_BLOCK_SIZE) {
        console.error(
          `Block too large: ${block.byteLength} bytes`
        );
        return;
      }

      stream.send(block);
    } catch (err) {
      console.error(
        "Failed to handle swap request:",
        err
      );
    } finally {
      await stream.close();
    }
  };
}

export async function getBlock(
  libp2p: Libp2p,
  peer: DialTarget,
  requestedCID: CID,
  signal: AbortSignal
) {

  if (requestedCID.multihash.code !== 0x12) {
    throw new Error(
      `unsupported multihash: ${requestedCID.multihash.code}`
    );
  }

  const stream = await libp2p.dialProtocol(
    peer,
    PROTOCOL,
    {
      signal
    }
  );

  try {
    stream.send(requestedCID.bytes);

    const block = new Uint8ArrayList();

    let size = 0;

    for await (const chunk of stream) {
      size += chunk.byteLength;

      if (size > MAX_BLOCK_SIZE) {
        throw new Error(`received block too large: ${size}`);
      }

      block.append(chunk);
    }

    const bytes = block.subarray();

    const digest = await sha256.digest(bytes);

    const actualCID = CID.create(
      requestedCID.version,
      requestedCID.code,
      digest
    );

    if (!actualCID.equals(requestedCID)) {
      throw new Error(
        `received block with incorrect CID: ` +
        `expected ${requestedCID}, got ${actualCID}`
      );
    }

    return bytes;
  } finally {
    await stream.close();
  }
}

