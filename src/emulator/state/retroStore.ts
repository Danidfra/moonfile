import { create } from 'zustand';

export type PlayerState = 'idle' | 'loading' | 'ready' | 'running' | 'paused' | 'error';

export interface RetroState {
  status: PlayerState;
  error: string | null;
  romInfo: {
    size: number;
    sha256: string;
    header: {
      mapper: number;
      prgBanks: number;
      chrBanks: number;
    };
  } | null;
}

export interface RetroActions {
  setStatus: (status: PlayerState) => void;
  setError: (error: string | null) => void;
  setRomInfo: (info: RetroState['romInfo']) => void;
  reset: () => void;
}

export const useRetroStore = create<RetroState & RetroActions>((set) => ({
  status: 'idle',
  error: null,
  romInfo: null,
  
  setStatus: (status) => set({ status, error: null }),
  setError: (error) => set({ error, status: 'error' }),
  setRomInfo: (romInfo) => set({ romInfo }),
  reset: () => set({ status: 'idle', error: null, romInfo: null })
}));