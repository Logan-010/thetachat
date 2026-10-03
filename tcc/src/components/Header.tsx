import { useEffect } from "preact/hooks";
import { useApp } from "../context";
import { useLocation } from "preact-iso";

export default function Header() {
  const { save, network, setNetwork } = useApp();
  const { route, path } = useLocation();

  useEffect(() => {
    if (save == null || network == null) {
      route("/save");
    }
  }, [save, network]);

  return <header class="border-b border-line bg-surface">
    <nav aria-label="Main navigation" class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
      <a href="/" aria-label="θchat home" class="flex items-center gap-2.5 rounded-lg font-semibold tracking-tight">
        <span class="flex size-9 items-center justify-center rounded-xl bg-accent-soft text-xl text-accent" aria-hidden="true">θ</span>
        <span class="text-lg">θchat</span>
      </a>
      <div class="flex flex-wrap items-center gap-1 sm:gap-2">
        <a href="/" aria-current={path === "/" ? "page" : undefined}
          class="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-soft hover:text-ink aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent">Chat</a>
        <a href="/save" aria-current={path === "/save" ? "page" : undefined}
          class="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-soft hover:text-ink aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent">Identity / backup</a>
    {network && <button class="btn-quiet" type="button" onClick={async () => {
      await network.stop();
      setNetwork(null);
    }}>Disconnect</button>}
      </div>
    </nav>
  </header>;
}
