import { useEffect, useRef, useState } from "preact/hooks";
import { useApp } from "../../context";
import { createSave, importSave, loadSave, setStorage } from "../../lib/save";
import Loading from "../../components/Loading";
import ArrowUpRight from "../../components/ArrowUpRight";
const { createNetwork } = await import("../../lib/net");
import { useLocation } from "preact-iso";

export default function Save() {
  const { save, setSave, network, setNetwork } = useApp();
  const { route } = useLocation();

  useEffect(() => {
    if (!save) {
      return;
    }

    setAlias(save.alias);
    setBootstrap(save.bootstrap);
    setRooms(save.rooms);

  }, [save, network]);

  const [loading, setLoading] = useState(true);
  const [editingSave, setEditingSave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function act(action: () => Promise<void>) {
    setError("");
    setBusy(true);
    try { await action(); } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); }
  }

  const [alias, setAlias] = useState("");
  const [bootstrap, setBootstrap] = useState<string[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);

  const [bootstrapInput, setBootstrapInput] = useState("");
  const [roomInput, setRoomInput] = useState("");

  useEffect(() => {
    (save ? Promise.resolve(save) : loadSave())
      .then((s) => {
        if (s != null) {
          setSave(s);
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => {
        setLoading(false);
        setEditingSave(true);
      });
  }, []);

  const addBootstrap = () => {
    const value = bootstrapInput.trim();

    if (!value || bootstrap.includes(value)) {
      return;
    }

    setBootstrap((items) => [...items, value]);
    setBootstrapInput("");
  };

  const removeBootstrap = (index: number) => {
    setBootstrap((items) => items.filter((_, i) => i !== index));
  };

  const addRoom = () => {
    const value = roomInput.trim();

    if (!value || rooms.includes(value)) {
      return;
    }

    setRooms((items) => [...items, value]);
    setRoomInput("");
  };

  const removeRoom = (index: number) => {
    setRooms((items) => items.filter((_, i) => i !== index));
  };

  async function connect() {
    if (save === null) {
      return;
    }
    if (!alias.trim()) throw new Error("Enter an alias");

    setStorage("alias", alias);
    setStorage("bootstrap", bootstrap);
    setStorage("rooms", rooms);

    save.alias = alias;
    save.bootstrap = bootstrap;
    save.rooms = rooms;

    const network = await createNetwork(save);

    setNetwork(network);
    route("/");
  }

  async function create() {
    setStorage("alias", alias);
    setStorage("bootstrap", bootstrap);
    setStorage("rooms", rooms);

    const sv = await createSave(alias, bootstrap, rooms);

    setSave(sv);
  }

  async function saveFile() {
    if (save === null) {
      return;
    }

    save.alias = alias;
    save.bootstrap = bootstrap;
    save.rooms = rooms;
    setStorage("alias", alias);
    setStorage("bootstrap", bootstrap);
    setStorage("rooms", rooms);
    let database: Uint8Array;
    if (network) database = await network.exportDatabase();
    else {
      const { peerIdFromPrivateKey } = await import("@libp2p/peer-id");
      const { open, save: exportDatabase } = await import("../../lib/db");
      const db = await open(peerIdFromPrivateKey(await save.keypair()).toString());
      try { database = await exportDatabase(db); } finally { db.close(); }
    }
    const content = await save.encode(database);
    save.database = undefined;

    const result = new Uint8Array(new ArrayBuffer(content.byteLength));
    result.set(content);

    const blob = new Blob([result], {
      type: "application/octet-stream",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${alias}.identity`;
    link.click();

    URL.revokeObjectURL(url);
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  function load() {
    fileInputRef.current?.click();
  }

  async function handleFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    try {
      const content = new Uint8Array(await file.arrayBuffer());

      const sv = await importSave(content);

      setSave(sv);
    } catch (e) {
      setError(String(e));
    } finally {
      input.value = "";
    }
  }

  if (loading) {
    return <Loading />;
  }

  return (
    <div class="mx-auto max-w-2xl space-y-6">
      <div class="text-center">
        <p class="section-label mb-3">{save ? "Your identity" : "Welcome to θchat"}</p>
        <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">Identity and backup</h1>
        <p class="mx-auto mt-3 max-w-md text-muted">A name, a connection, and a place to chat. Your identity and messages stay in your browser.</p>
      </div>
      {error && <p class="notice" role="alert">{error}</p>}
      {network && <p class="rounded-xl border border-accent/20 bg-accent-soft px-4 py-3 text-sm text-accent">Disconnect before editing your identity or network settings.</p>}
      <fieldset class="panel min-w-0 p-5 sm:p-8" disabled={busy || network !== null}>
      <legend class="sr-only">Identity and network settings</legend>
      {editingSave && (
        <div class="space-y-7">
          <div>
            <label class="field-label" htmlFor="alias">Your alias</label>
            <input
              id="alias"
              type="text"
              placeholder="Enter alias..."
              value={alias}
              onInput={(e) =>
                setAlias((e.currentTarget as HTMLInputElement).value)
              }
            />
          </div>

          <div class="border-t border-line pt-6">
            <label class="field-label" htmlFor="bootstrap-address">Bootstrap nodes</label>
            <p class="mb-3 text-xs text-muted">Add a WebSocket address to connect with other peers.</p>

            <div class="flex gap-2">
              <input
                id="bootstrap-address"
                class="font-mono text-xs"
                type="text"
                placeholder="Enter bootstrap address..."
                value={bootstrapInput}
                onInput={(e) =>
                  setBootstrapInput((e.currentTarget as HTMLInputElement).value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addBootstrap();
                  }
                }}
              />

              <button class="btn" type="button" onClick={addBootstrap}>
                Add
              </button>
            </div>

            <ul class="mt-3 space-y-2">
              {bootstrap.map((address, index) => (
                <li class="flex items-center justify-between gap-3 rounded-xl border border-line bg-soft/50 px-3 py-2" key={address}>
                  <span class="min-w-0 break-all font-mono text-xs text-muted">{address}</span>

                  <button class="btn-quiet hover:text-danger" type="button" aria-label={`Remove ${address}`} onClick={() => removeBootstrap(index)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div class="border-t border-line pt-6">
            <label class="field-label" htmlFor="room-name">Rooms</label>
            <p class="mb-3 text-xs text-muted">Choose a shared room name. You can join more rooms later.</p>

            <div class="flex gap-2">
              <input
                id="room-name"
                type="text"
                placeholder="Enter room..."
                value={roomInput}
                onInput={(e) =>
                  setRoomInput((e.currentTarget as HTMLInputElement).value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addRoom();
                  }
                }}
              />

              <button class="btn" type="button" onClick={addRoom}>
                Add
              </button>
            </div>

            <ul class="mt-3 flex flex-wrap gap-2">
              {rooms.map((room, index) => (
                <li class="flex max-w-full items-center gap-2 rounded-xl border border-line bg-soft/50 py-1.5 pr-1.5 pl-3" key={room}>
                  <span class="min-w-0 text-sm [overflow-wrap:anywhere]"><span class="mr-1 text-muted" aria-hidden="true">#</span>{room}</span>

                  <button class="btn-quiet hover:text-danger" type="button" aria-label={`Remove ${room}`} onClick={() => removeRoom(index)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {save !== null ? (
        <div class="mt-7 border-t border-line pt-6">
          <button class="btn-primary w-full" type="button" onClick={() => void act(connect)}>
            {busy ? "Connecting…" : "Connect"}<ArrowUpRight />
          </button>

        </div>
      ) : (
        <div class="mt-7 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
          <button class="btn-primary" type="button" onClick={() => void act(create)}>
            {busy ? "Creating…" : "Create"}
          </button>

          <button class="btn" type="button" onClick={load}>
            Load
          </button>

        </div>
      )}
      </fieldset>
      {save && <section class="panel p-5 sm:p-6" aria-label="Backups">
        <h2 class="font-semibold">Keep a copy</h2>
        <p class="mt-1 text-sm text-muted">Take your identity and conversation history with you.</p>
        <div class="mt-4 flex flex-wrap gap-3">
          <button class="btn" type="button" disabled={busy} onClick={() => void act(saveFile)}>Export identity and messages</button>
          {!network && <button class="btn" type="button" disabled={busy} onClick={load}>Import identity and messages</button>}
        </div>
      </section>}
      <input ref={fileInputRef} type="file" hidden onChange={event => void act(() => handleFile(event))} />
      <p class="text-center text-xs text-muted">Local history. Peer-to-peer connections. Your conversations.</p>
    </div>
  );
}
