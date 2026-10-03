import { decode, encode } from "cbor2";
import { CID } from "multiformats/cid";

export const SWAP_PROTOCOL = "/thetachat/swap/1.0.0";
export const MAX_MESSAGE_SIZE = 1 << 20;

export type Message = {
  timestamp: number;
  name: string;
  content: { type: 0 | 1 | 2; cid: Uint8Array };
};

export type Request = {
  type: 0 | 1;
  timestamp: number;
  messages: Message[] | null;
};

export function encodeRequest(request: Request) {
  return encode(request);
}

export function decodeRequest(data: Uint8Array): Request {
  if (data.byteLength > MAX_MESSAGE_SIZE) throw new Error("Request too large");
  const value = decode<Request>(data);
  if (!value || ![0, 1].includes(value.type) || !Number.isSafeInteger(value.timestamp)) {
    throw new Error("Invalid room request");
  }
  if (value.type === 1) {
    if (!Array.isArray(value.messages) || value.messages.length > 100) throw new Error("Invalid message batch");
    for (const msg of value.messages) {
      if (!msg || !Number.isSafeInteger(msg.timestamp) || msg.timestamp < 0 ||
          typeof msg.name !== "string" || ![0, 1, 2].includes(msg.content?.type) ||
          !(msg.content.cid instanceof Uint8Array)) throw new Error("Invalid room message");
      CID.decode(msg.content.cid);
    }
  }
  return value;
}
