import { useEffect, useState } from "preact/hooks";
import { useApp } from "../../context";
import type { RoomMessage } from "../../lib/db";
import type { Message as DirectMessage } from "../../lib/dm";

type Conversation = { type: "room" | "dm"; id: string };

export default function Home() {
  const { network } = useApp();
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [contacts, setContacts] = useState<string[]>([]);
  const [messages, setMessages] = useState<(RoomMessage | DirectMessage)[]>([]);
  const [room, setRoom] = useState("");
  const [peer, setPeer] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => network?.subscribe(() => setVersion(value => value + 1)), [network]);
  useEffect(() => {
    if (!network) return;
    if (!selected && network.rooms.length) setSelected({ type: "room", id: network.rooms[0] });
    let active = true;
    network.contacts().then(items => { if (active) setContacts(items); }).catch(showError);
    return () => { active = false; };
  }, [network, version]);
  useEffect(() => {
    setMessages([]);
    setDraft("");
    setError("");
  }, [selected?.type, selected?.id]);
  useEffect(() => {
    if (!network || !selected) return;
    let active = true;
    const history = selected.type === "room" ? network.messages(selected.id) : network.directMessages(selected.id);
    history.then(items => { if (active) setMessages(items); }).catch(showError);
    return () => { active = false; };
  }, [network, selected?.type, selected?.id, version]);

  function showError(error: unknown) {
    setError(error instanceof Error ? error.message : String(error));
  }
  async function act(action: () => Promise<void>) {
    setError("");
    setBusy(true);
    try { await action(); } catch (error) { showError(error); } finally { setBusy(false); }
  }

  if (!network) return <p><a href="/save">Set up your identity and connect</a> to start chatting.</p>;

  return <div>
    <h1>θchat</h1>
    <p>Your peer ID: <code>{network.id}</code></p>
    <p>Connected peers: {network.peers.length}</p>
    {(error || network.error) && <p role="alert">{error || network.error}</p>}

    <section aria-label="Group chats">
      <h2>Group chats</h2>
      <form onSubmit={event => {
        event.preventDefault();
        void act(async () => {
          const name = room.trim();
          await network.joinRoom(name);
          setSelected({ type: "room", id: name });
          setRoom("");
        });
      }}>
        <input aria-label="Room name" placeholder="Room name" value={room} onInput={event => setRoom(event.currentTarget.value)} />
        <button disabled={busy || !room.trim()}>Join room</button>
      </form>
      <ul>{network.rooms.map(name => <li key={name}>
        <button type="button" aria-pressed={selected?.type === "room" && selected.id === name}
          onClick={() => setSelected({ type: "room", id: name })}>{name}</button>
        <button type="button" disabled={busy} onClick={() => void act(async () => {
          await network.leaveRoom(name);
          if (selected?.type === "room" && selected.id === name) setSelected(null);
        })}>Leave</button>
      </li>)}</ul>
    </section>

    <section aria-label="Direct messages">
      <h2>Direct messages</h2>
      <form onSubmit={event => {
        event.preventDefault();
        void act(async () => {
          const id = await network.addContact(peer);
          setSelected({ type: "dm", id });
          setPeer("");
        });
      }}>
        <input aria-label="Recipient peer ID" placeholder="Recipient peer ID" value={peer} onInput={event => setPeer(event.currentTarget.value)} />
        <button disabled={busy || !peer.trim()}>Open conversation</button>
      </form>
      <ul>{contacts.map(id => <li key={id}><button type="button"
        aria-pressed={selected?.type === "dm" && selected.id === id}
        onClick={() => setSelected({ type: "dm", id })}>{id}</button></li>)}</ul>
    </section>

    {selected && <section aria-label="Conversation">
      <h2>{selected.type === "room" ? `Room: ${selected.id}` : `DM: ${selected.id}`}</h2>
      {selected.type === "room" && <button type="button" disabled={busy} onClick={() => void act(async () => {
        const first = messages[0]?.timestamp;
        await network.requestHistory(selected.id, first ?? Date.now() + 1);
      })}>Load older messages</button>}
      {!messages.length && <p>No messages yet.</p>}
      <ol aria-live="polite">{messages.map(msg => <li key={msg.id}>
        <strong>{"room" in msg ? msg.name : msg.direction === "outgoing" ? "You" : msg.userId}</strong>{" "}
        <time dateTime={new Date(msg.timestamp).toISOString()}>{new Date(msg.timestamp).toLocaleString()}</time>
        <p style={{ whiteSpace: "pre-wrap" }}>{"room" in msg
          ? msg.text ?? (msg.content.type === 0 ? "Fetching message content…" : "Attachment/media message")
          : msg.content}</p>
        {"room" in msg && msg.status === "pending" && <small>Saved locally — waiting to publish.</small>}
      </li>)}</ol>
      <form onSubmit={event => {
        event.preventDefault();
        const conversation = selected;
        const content = draft;
        void act(async () => {
          if (conversation.type === "room") await network.sendRoom(conversation.id, content);
          else await network.dm(conversation.id, content);
          setDraft("");
        });
      }}>
        <textarea aria-label="Message" placeholder="Write a message" value={draft}
          onInput={event => setDraft(event.currentTarget.value)} disabled={busy} />
        <button disabled={busy || !draft.trim()}>Send</button>
      </form>
    </section>}
  </div>;
}
