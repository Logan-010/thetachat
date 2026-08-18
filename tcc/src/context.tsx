import { createContext, type ComponentChildren } from "preact";
import { useContext, useState } from "preact/hooks";

import { Save } from "./lib/save";
import { Network } from "./lib/net";

type AppContextType = {
  save: Save | null;
  setSave: (save: Save | null) => void;
  network: Network | null;
  setNetwork: (network: Network | null) => void;
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ComponentChildren }) {
  const [save, setSave] = useState<Save | null>(null);
  const [network, setNetwork] = useState<Network | null>(null);

  const value: AppContextType = {
    save,
    setSave,
    network,
    setNetwork,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextType {
  const context = useContext(AppContext);

  if (context === null) {
    throw new Error("useApp must be used within an AppProvider");
  }

  return context;
}
