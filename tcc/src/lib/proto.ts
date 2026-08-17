import {CID} from "multiformats/cid";

export const PROTOCOL = "/thetachat/swap/1.0.0";

export type MessageContent =
  | [0, CID] 
  | [1, CID] 
  | [2, CID]

export type Message = [
  timestamp: bigint,
  name: string,
  content: MessageContent
]

export type Request =
  | [0, timestamp: bigint]
  | [1, messages: Message[]]
