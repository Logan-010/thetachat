import { useEffect, useRef, useState } from "preact/hooks";
import { useApp } from "../../context";
import { createSave, importSave, loadSave, setStorage } from "../../lib/save";
import Loading from "../../components/Loading";
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

    if (network) {
      route("/");
    }
  }, [save, network]);

  const [loading, setLoading] = useState(true);
  const [editingSave, setEditingSave] = useState(false);

  const [alias, setAlias] = useState("");
  const [bootstrap, setBootstrap] = useState<string[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);

  const [bootstrapInput, setBootstrapInput] = useState("");
  const [roomInput, setRoomInput] = useState("");

  useEffect(() => {
    loadSave()
      .then((s) => {
        if (s != null) {
          setSave(s);
        }
      })
      .catch((e) => alert(new String(e)))
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

    setStorage("alias", alias);
    setStorage("bootstrap", bootstrap);
    setStorage("rooms", rooms);

    save.alias = alias;
    save.bootstrap = bootstrap;
    save.rooms = rooms;

    const network = await createNetwork(save);

    setNetwork(network);
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

    const content = await save.encode();

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
      const content = await file.bytes();

      const sv = await importSave(content);

      setSave(sv);
    } catch (e) {
      alert(new String(e));
    } finally {
      input.value = "";
    }
  }

  if (loading) {
    return <Loading />;
  }

  return (
    <div>
      {editingSave && (
        <div>
          <div>
            <input
              type="text"
              placeholder="Enter alias..."
              value={alias}
              onInput={(e) =>
                setAlias((e.currentTarget as HTMLInputElement).value)
              }
            />
          </div>

          <div>
            <h3>Bootstrap Nodes</h3>

            <div>
              <input
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

              <button type="button" onClick={addBootstrap}>
                Add
              </button>
            </div>

            <ul>
              {bootstrap.map((address, index) => (
                <li key={address}>
                  <span>{address}</span>

                  <button type="button" onClick={() => removeBootstrap(index)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Rooms</h3>

            <div>
              <input
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

              <button type="button" onClick={addRoom}>
                Add
              </button>
            </div>

            <ul>
              {rooms.map((room, index) => (
                <li key={room}>
                  <span>{room}</span>

                  <button type="button" onClick={() => removeRoom(index)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {save !== null ? (
        <div>
          <button type="button" onClick={connect}>
            Connect
          </button>

          <button type="button" onClick={saveFile}>
            Save
          </button>
        </div>
      ) : (
        <div>
          <button type="button" onClick={create}>
            Create
          </button>

          <button type="button" onClick={load}>
            Load
          </button>

          <input ref={fileInputRef} type="file" hidden onChange={handleFile} />
        </div>
      )}
    </div>
  );
}
