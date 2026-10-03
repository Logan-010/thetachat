import { useEffect, useState } from "preact/hooks";
import { useApp } from "../../context";
import type { RoomMessage } from "../../lib/db";
import type { Message as DirectMessage } from "../../lib/dm";
import ArrowUpRight from "../../components/ArrowUpRight";

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

  if (!network) return <div class="panel mx-auto max-w-xl p-8 text-center">
    <h1 class="text-2xl font-semibold tracking-tight">A place to connect.</h1>
    <p class="mt-3 text-muted">Set up your identity to start chatting.</p>
    <a class="btn-primary mt-6" href="/save">Set up your identity and connect</a>
  </div>;

  return <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="section-label mb-2">Your space</p>
        <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">Conversations</h1>
        <p class="mt-2 text-muted">A shared room or a quiet conversation.</p>
      </div>
      <span class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted">
        <span class={`size-1.5 rounded-full ${network.peers.length ? "bg-accent" : "bg-muted"}`} aria-hidden="true" />
        Connected peers: {network.peers.length}
      </span>
    </div>
    <details class="rounded-xl border border-line bg-surface px-4 py-3 text-xs text-muted">
      <summary class="w-fit cursor-pointer rounded font-medium focus-visible:outline-2 focus-visible:outline-accent">Your peer ID <span class="ml-1 font-normal">· share it for direct messages</span></summary>
      <code class="mt-2 block select-all break-all text-ink">{network.id}</code>
    </details>
    {(error || network.error) && <p class="notice" role="alert">{error || network.error}</p>}

    <div class="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
    <aside class="panel min-w-0 space-y-7 p-5" aria-label="Conversations">
    <section aria-label="Group chats">
      <h2 class="section-label mb-4">Group chats</h2>
      <form class="flex gap-2" onSubmit={event => {
        event.preventDefault();
        void act(async () => {
          const name = room.trim();
          await network.joinRoom(name);
          setSelected({ type: "room", id: name });
          setRoom("");
        });
      }}>
        <input class="text-sm" aria-label="Room name" placeholder="Room name" value={room} onInput={event => setRoom(event.currentTarget.value)} />
        <button class="btn" disabled={busy || !room.trim()}>Join room</button>
      </form>
      <ul class="mt-3 space-y-1">{network.rooms.map(name => <li class="flex min-w-0 items-center gap-1" key={name}>
        <button class="conversation-link flex items-start gap-2" type="button" aria-pressed={selected?.type === "room" && selected.id === name}
          onClick={() => setSelected({ type: "room", id: name })}><span class="font-normal opacity-60" aria-hidden="true">#</span><span class="min-w-0">{name}</span></button>
        <button class="btn-quiet hover:text-danger" aria-label={`Leave ${name}`} type="button" disabled={busy} onClick={() => void act(async () => {
          await network.leaveRoom(name);
          if (selected?.type === "room" && selected.id === name) setSelected(null);
        })}>Leave</button>
      </li>)}</ul>
      {!network.rooms.length && <p class="mt-3 text-xs text-muted">Join a room to find your people.</p>}
    </section>

    <section class="border-t border-line pt-6" aria-label="Direct messages">
      <h2 class="section-label mb-4">Direct messages</h2>
      <form class="space-y-2" onSubmit={event => {
        event.preventDefault();
        void act(async () => {
          const id = await network.addContact(peer);
          setSelected({ type: "dm", id });
          setPeer("");
        });
      }}>
        <input class="text-sm" aria-label="Recipient peer ID" placeholder="Recipient peer ID" value={peer} onInput={event => setPeer(event.currentTarget.value)} />
        <button class="btn w-full" disabled={busy || !peer.trim()}>Open conversation</button>
      </form>
      <ul class="mt-3 space-y-1">{contacts.map(id => <li key={id}><button class="conversation-link flex items-center gap-2.5" type="button" title={id} aria-label={id}
        aria-pressed={selected?.type === "dm" && selected.id === id}
        onClick={() => setSelected({ type: "dm", id })}>
          <span class="flex size-7 shrink-0 items-center justify-center rounded-full border border-line" aria-hidden="true"><ArrowUpRight /></span>
          <span class="min-w-0 truncate font-mono text-xs">{id}</span>
        </button></li>)}</ul>
    </section>
    </aside>

    {selected ? <section class="panel flex min-h-[30rem] min-w-0 flex-col overflow-hidden lg:min-h-[38rem]" aria-label="Conversation">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div class="min-w-0 flex-1">
          <p class="section-label mb-1">{selected.type === "room" ? "Group chat" : "Direct message"}</p>
          <h2 class="truncate text-lg font-semibold tracking-tight" title={selected.id}>
            {selected.type === "room" ? `# ${selected.id}` : `${selected.id.slice(0, 12)}…${selected.id.slice(-6)}`}
          </h2>
        </div>
      {selected.type === "room" && <button class="btn-quiet" type="button" disabled={busy} onClick={() => void act(async () => {
        const first = messages[0]?.timestamp;
        await network.requestHistory(selected.id, first ?? Date.now() + 1);
      })}>Load older messages</button>}
      </div>
      {!messages.length && <div class="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <span class="mb-2 flex size-12 items-center justify-center rounded-2xl bg-soft text-2xl text-muted" aria-hidden="true">θ</span>
        <p class="font-medium">No messages yet.</p>
        <p class="text-sm text-muted">Say hello. Every conversation starts somewhere.</p>
      </div>}
      <ol class={`max-h-[55dvh] space-y-4 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6 ${messages.length ? "flex-1" : "hidden"}`} aria-live="polite">{messages.map(msg => <li class={`flex ${!("room" in msg) && msg.direction === "outgoing" ? "justify-end" : "justify-start"}`} key={msg.id}>
        <div class={`max-w-[95%] min-w-0 rounded-2xl border px-4 py-3 sm:max-w-[85%] ${!("room" in msg) && msg.direction === "outgoing" ? "border-accent/15 bg-accent-soft" : "border-line bg-soft/50"}`}>
        <div class="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <strong class="min-w-0 text-xs font-semibold [overflow-wrap:anywhere]" title={"room" in msg ? msg.name : msg.userId}>{"room" in msg ? msg.name : msg.direction === "outgoing" ? "You" : `${msg.userId.slice(0, 10)}…${msg.userId.slice(-6)}`}</strong>
          <time class="text-[11px] text-muted" title={new Date(msg.timestamp).toLocaleString()} dateTime={new Date(msg.timestamp).toISOString()}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
        </div>
        <p class="whitespace-pre-wrap [overflow-wrap:anywhere]">{"room" in msg
          ? msg.text ?? (msg.content.type === 0 ? "Fetching message content…" : "Attachment/media message")
          : msg.content}</p>
        {"room" in msg && msg.status === "pending" && <small class="mt-2 block text-xs text-muted">Saved locally — waiting to publish.</small>}
        </div>
      </li>)}</ol>
      <form class="mt-auto flex flex-col gap-3 border-t border-line bg-surface p-4 sm:flex-row sm:items-end sm:p-5" onSubmit={event => {
        event.preventDefault();
        const conversation = selected;
        const content = draft;
        void act(async () => {
          if (conversation.type === "room") await network.sendRoom(conversation.id, content);
          else await network.dm(conversation.id, content);
          setDraft("");
        });
      }}>
        <textarea class="min-h-24 max-h-60 flex-1 bg-soft/50" rows={2} aria-label="Message" placeholder="Write a message…" value={draft}
          onInput={event => setDraft(event.currentTarget.value)} disabled={busy} />
        <button class="btn-primary sm:mb-0.5" disabled={busy || !draft.trim()}>Send <ArrowUpRight /></button>
      </form>
    </section> : <div class="panel flex min-h-80 flex-col items-center justify-center p-8 text-center lg:min-h-[38rem]">
      <span class="mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-3xl text-accent" aria-hidden="true">θ</span>
      <h2 class="text-xl font-semibold tracking-tight">Make yourself at home.</h2>
      <p class="mt-2 max-w-xs text-muted">Join a room or open a direct message to start a conversation.</p>
    </div>}
    </div>
  </div>;
}
