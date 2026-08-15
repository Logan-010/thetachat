import {CID} from "multiformats/cid";

export type MessageContent =
  | [0, CID] 
  | [1, CID] 
  | [2, CID]

export type Message = [
  timestamp: bigint,
  username: string,
  content: MessageContent
]

export type Request =
  | [0, timestamp: bigint]
  | [1, messages: Message[]]
