import { useEffect } from "preact/hooks";
import { useApp } from "../context";
import { useLocation } from "preact-iso";

export default function Header() {
  const { save, network } = useApp();
  const { route } = useLocation();

  useEffect(() => {
    if (save == null || network == null) {
      route("/save");
    }
  }, [save, network]);

  return <p>TODO!</p>;
}
