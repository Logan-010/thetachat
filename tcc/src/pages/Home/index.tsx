import { useEffect, useState } from "preact/hooks";
import { useApp } from "../../context";
import { loadSave } from "../../lib/save";
import Loading from "../../components/Loading";

export default function Home() {
  const { save, setSave } = useApp();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSave().then((s) => {
      if (s != null) {
        setSave(s);
      }
    }).catch((e) => alert(new String(e))).finally(() => {
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <Loading/>;
  }

  return (
    <div>
      {save !== null ? (<button>Connect</button>) : (<div></div>)}       
    </div>
  );
}
