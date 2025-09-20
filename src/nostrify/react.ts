import { createContext, useContext, useEffect, useState } from 'react';
import { NPool, NRelay1, NostrSigner } from '@nostrify/nostrify';
import { useAppContext } from '@/hooks/useAppContext';

interface NostrContextType {
  nostr: NPool | null;
  isConnected: boolean;
  signer: NostrSigner | null;
}

const NostrContext = createContext<NostrContextType | undefined>(undefined);

export function useNostr() {
  const context = useContext(NostrContext);
  if (context === undefined) {
    throw new Error('useNostr must be used within a NostrProvider');
  }
  return context;
}

interface NostrProviderProps {
  children: React.ReactNode;
}

export function NostrProvider({ children }: NostrProviderProps) {
  const { config } = useAppContext();
  const [nostr, setNostr] = useState<NPool | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [signer, setSigner] = useState<NostrSigner | null>(null);

  const connect = async () => {
    try {
      // Initialize signer from window.nostr if available
      if (typeof window !== 'undefined' && window.nostr) {
        setSigner(window.nostr as NostrSigner);
      }

      // Create relay list from config
      const relays: NRelay1[] = [
        { url: config.relayUrl, read: true, write: true }
      ];

      // Create pool with relays
      const pool = new NPool({ relays });
      
      // Connect to relays
      await pool.connect();
      
      setNostr(pool);
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to connect to Nostr:', error);
      setIsConnected(false);
    }
  };

  const disconnect = () => {
    if (nostr) {
      nostr.close();
      setNostr(null);
      setIsConnected(false);
      setSigner(null);
    }
  };

  useEffect(() => {
    // Auto-connect on mount if not already connected
    if (!nostr && !isConnected) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      if (nostr) {
        disconnect();
      }
    };
  }, []);

  const value: NostrContextType = {
    nostr,
    isConnected,
    signer,
  };

  return (
    <NostrContext.Provider value={value}>
      {children}
    </NostrContext.Provider>
  );
}