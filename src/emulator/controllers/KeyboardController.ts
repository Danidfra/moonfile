import { Controller } from "jsnes";

// Mapping keyboard code to [controller, button, label]
const KEYS: Record<number, [number, number, string]> = {
  88: [1, Controller.BUTTON_A, "X"],
  89: [1, Controller.BUTTON_B, "Y"], // Central European keyboard
  90: [1, Controller.BUTTON_B, "Z"],
  17: [1, Controller.BUTTON_SELECT, "Right Ctrl"],
  13: [1, Controller.BUTTON_START, "Enter"],
  38: [1, Controller.BUTTON_UP, "Up"],
  40: [1, Controller.BUTTON_DOWN, "Down"],
  37: [1, Controller.BUTTON_LEFT, "Left"],
  39: [1, Controller.BUTTON_RIGHT, "Right"],
  103: [2, Controller.BUTTON_A, "Num-7"],
  105: [2, Controller.BUTTON_B, "Num-9"],
  99: [2, Controller.BUTTON_SELECT, "Num-3"],
  97: [2, Controller.BUTTON_START, "Num-1"],
  104: [2, Controller.BUTTON_UP, "Num-8"],
  98: [2, Controller.BUTTON_DOWN, "Num-2"],
  100: [2, Controller.BUTTON_LEFT, "Num-4"],
  102: [2, Controller.BUTTON_RIGHT, "Num-6"],
};

type KeyboardControllerOptions = {
  onButtonDown: (player: number, button: number) => void;
  onButtonUp: (player: number, button: number) => void;
};

export default class KeyboardController {
  private onButtonDown: (player: number, button: number) => void;
  private onButtonUp: (player: number, button: number) => void;
  private keys: Record<number, [number, number, string]> = KEYS;

  constructor(options: KeyboardControllerOptions) {
    this.onButtonDown = options.onButtonDown;
    this.onButtonUp = options.onButtonUp;
  }

  loadKeys = (): void => {
    try {
      const storedKeys = localStorage.getItem("keys");
      if (storedKeys) {
        this.keys = JSON.parse(storedKeys);
        return;
      }
    } catch (e) {
      console.log("Failed to get keys from localStorage.", e);
    }
    this.keys = KEYS;
  };

  setKeys = (newKeys: Record<number, [number, number, string]>): void => {
    try {
      localStorage.setItem("keys", JSON.stringify(newKeys));
      this.keys = newKeys;
    } catch (e) {
      console.log("Failed to set keys in localStorage", e);
    }
  };

  handleKeyDown = (e: KeyboardEvent): void => {
    const key = this.keys[e.keyCode];
    if (key) {
      this.onButtonDown(key[0], key[1]);
      e.preventDefault();
    }
  };

  handleKeyUp = (e: KeyboardEvent): void => {
    const key = this.keys[e.keyCode];
    if (key) {
      this.onButtonUp(key[0], key[1]);
      e.preventDefault();
    }
  };

  handleKeyPress = (e: KeyboardEvent): void => {
    e.preventDefault();
  };
}