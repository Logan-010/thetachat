import { createContext } from 'preact';
import { useContext, useState } from 'preact/hooks';
import { Save } from './lib/save';
import { Network } from './lib/net';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [save, setSave] = useState<null | Save>(null);
  const [network, setNetwork] = useState<null | Network>(null);

  const value = {
    save, setSave, network, setNetwork
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
