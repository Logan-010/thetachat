import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { encode } from "cbor2";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import { Uint8ArrayList } from "uint8arraylist";
import { open, save, load, roomMessages, messageId } from "../src/lib/db.ts";
import { decodeRequest, encodeRequest } from "../src/lib/proto.ts";
import { dmHandler, sendDm } from "../src/lib/dm.ts";
import { getBlock } from "../src/lib/swap.ts";

const goFixture = "a36474797065016974696d657374616d7000686d6573736167657381a36974696d657374616d70187b646e616d6565616c69636567636f6e74656e74a264747970650063636964582401551220c7d01489080858c56e777dbee9c4795a8dd29f351e4d3a6be4a282b22d3f87e1";

test("decodes reference Go CBOR with binary CIDs and rejects malformed requests", () => {
  const request = decodeRequest(new Uint8Array(Buffer.from(goFixture, "hex")));
  assert.equal(request.messages![0].name, "alice");
  assert.equal(CID.decode(request.messages![0].content.cid).toString(), "bafkreigh2akiscaildcw4535x3u4i6k2rxjj6ni6ju5gxzfcqkzc2p4h4e");
  assert.deepEqual(decodeRequest(encodeRequest(request)), request);
  assert.throws(() => decodeRequest(encode({ type: 1, timestamp: 0, messages: [{ timestamp: 1, name: "bad" }] })));
});

test("IndexedDB retains room and DM history across reopening and backup roundtrips", async () => {
  let db = await open("storage-test");
  const message = decodeRequest(new Uint8Array(Buffer.from(goFixture, "hex"))).messages![0];
  const record = { ...message, room: "general", id: messageId("general", message), text: "hello" };
  await db.put("messages", record);
  await db.put("messages", { ...record, room: "other", id: messageId("other", message) });
  await db.put("dms", { id: "dm-1", userId: "bob", content: "private", timestamp: 123, direction: "outgoing" });
  await db.put("blocks", new Uint8Array([1, 2, 3]), "block");
  const backup = await save(db);
  db.close();
  db = await open("storage-test");
  assert.equal((await roomMessages(db, "general")).length, 1);
  assert.equal((await db.getAllFromIndex("dms", "userId", "bob"))[0].content, "private");
  const restored = await open("restored-test");
  await load(restored, backup);
  assert.deepEqual(await roomMessages(restored, "general"), [record]);
  assert.equal((await restored.get("dms", "dm-1")).direction, "outgoing");
  // Key-path stores must be restored without supplying an explicit key.
  assert.deepEqual(await restored.get("blocks", "block"), new Uint8Array([1, 2, 3]));
  const isolated = await open("different-identity");
  assert.equal((await isolated.getAll("messages")).length, 0);
  db.close(); restored.close(); isolated.close();
});

test("failed imports roll back all stores rather than partially replacing history", async () => {
  const db = await open("rollback-test");
  await db.put("meta", "keep", "existing");
  const corrupt = encode({ meta: { replaced: "bad" }, blocks: {}, dms: { broken: { content: "missing id" } }, messages: {} });
  await assert.rejects(load(db, corrupt));
  assert.equal(await db.get("meta", "existing"), "keep");
  assert.equal(await db.get("meta", "replaced"), undefined);
  db.close();
});

test("one DM stream becomes one saved message even when UTF-8 is fragmented", async () => {
  const db = await open("dm-test");
  const text = "hello 🌍\nsecond line";
  const bytes = new TextEncoder().encode(text);
  let callbackCount = 0;
  let closed = false;
  const stream = {
    async *[Symbol.asyncIterator]() {
      for (const byte of bytes) yield new Uint8ArrayList(new Uint8Array([byte]));
    },
    async close() { closed = true; },
  };
  await dmHandler(db, msg => { assert.equal(msg.content, text); callbackCount++; })(stream as any, { remotePeer: { toString: () => "sender" } } as any);
  const messages = await db.getAllFromIndex("dms", "userId", "sender");
  assert.equal(messages.length, 1);
  assert.equal(messages[0].direction, "incoming");
  assert.equal(callbackCount, 1);
  assert.ok(closed);
  db.close();
});

test("DM sending waits for stream backpressure before closing", async () => {
  const calls: string[] = [];
  const stream = {
    send(bytes: Uint8Array) { assert.equal(new TextDecoder().decode(bytes), "test"); calls.push("send"); return false; },
    async onDrain() { calls.push("drain"); },
    async close() { calls.push("close"); },
  };
  await sendDm({ dialProtocol: async () => stream } as any, {} as any, "test", AbortSignal.timeout(1000));
  assert.deepEqual(calls, ["send", "drain", "close"]);
});

test("swap verifies fragmented blocks against their CID", async () => {
  const bytes = new TextEncoder().encode("message block");
  const cid = CID.createV1(0x55, await sha256.digest(bytes));
  function node(data: Uint8Array) {
    return { dialProtocol: async () => ({
      send(request: Uint8Array) { assert.deepEqual(request, cid.bytes); return true; },
      async *[Symbol.asyncIterator]() { yield data.slice(0, 3); yield new Uint8ArrayList(data.slice(3)); },
      async close() {},
    }) } as any;
  }
  assert.deepEqual(await getBlock(node(bytes), {} as any, cid, AbortSignal.timeout(1000)), bytes);
  await assert.rejects(getBlock(node(new Uint8Array([0])), {} as any, cid, AbortSignal.timeout(1000)), /incorrect CID/);
});

test("swap timeout aborts a stream that never finishes sending its block", async () => {
  const cid = CID.createV1(0x55, await sha256.digest(new Uint8Array([1])));
  let rejectRead: (error: Error) => void;
  const waiting = new Promise<never>((_, reject) => { rejectRead = reject; });
  let closed = false;
  const node = { dialProtocol: async () => ({
    send() { return true; },
    abort(error: Error) { rejectRead(error); },
    async *[Symbol.asyncIterator]() { await waiting; },
    async close() { closed = true; },
  }) } as any;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Request timed out")), 25);
  try { await assert.rejects(getBlock(node, {} as any, cid, controller.signal), /timed out/i); }
  finally { clearTimeout(timer); }
  assert.ok(closed);
});
