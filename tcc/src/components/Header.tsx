import { useEffect } from "preact/hooks";
import { useApp } from "../context";
import { useLocation } from "preact-iso";

export default function Header() {
  const { save, network, setNetwork } = useApp();
  const { route } = useLocation();

  useEffect(() => {
    if (save == null || network == null) {
      route("/save");
    }
  }, [save, network]);

  return <nav>
    <a href="/">Chat</a>{" · "}<a href="/save">Identity / backup</a>
    {network && <button type="button" onClick={async () => {
      await network.stop();
      setNetwork(null);
    }}>Disconnect</button>}
  </nav>;
}
