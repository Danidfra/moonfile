/// <reference types="vite/client" />

// EmulatorJS global types
declare global {
  interface Window {
    EJS_player?: HTMLElement;
    EJS_gameUrl?: string;
    EJS_core?: string;
    EJS_pathtodata?: string;
    EJS_pathtocore?: string;
    EJS_pathtobios?: string;
    EJS_startOnLoaded?: boolean;
    EJS_DEBUG_XX?: boolean;
    EJS_gameID?: string;
    EJS_gameName?: string;
    EJS_color?: string;
    EJS_VirtualGamepadSettings?: {
      enable: boolean;
      opacity: number;
    };
    EJS_emulator?: {
      pause: () => void;
      resume: () => void;
      restart: () => void;
      setVolume: (volume: number) => void;
      destroy: () => void;
    };
  }
}
