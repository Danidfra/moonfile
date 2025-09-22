interface ButtonInfo {
  gamepadId: string;
  type: "button" | "axis";
  code: number;
  value?: number;
}

interface GamepadConfig {
  playerGamepadId: (string | null)[];
  configs: {
    [id: string]: {
      buttons: {
        type: "button" | "axis";
        code: number;
        value?: number;
        buttonId: number;
      }[];
    };
  };
}

interface GamepadControllerOptions {
  onButtonDown: (playerId: number, buttonId: number) => void;
  onButtonUp: (playerId: number, buttonId: number) => void;
}

export default class GamepadController {
  private onButtonDown: (playerId: number, buttonId: number) => void;
  private onButtonUp: (playerId: number, buttonId: number) => void;
  private gamepadState: any[];
  private buttonCallback: ((info: ButtonInfo) => void) | null;
  private gamepadConfig?: GamepadConfig;

  constructor(options: GamepadControllerOptions) {
    this.onButtonDown = options.onButtonDown;
    this.onButtonUp = options.onButtonUp;
    this.gamepadState = [];
    this.buttonCallback = null;
  }

  disableIfGamepadEnabled = (
    callback: (playerId: number, buttonId: number) => void
  ) => {
    return (playerId: number, buttonId: number) => {
      if (!this.gamepadConfig) {
        return callback(playerId, buttonId);
      }

      const playerGamepadId = this.gamepadConfig.playerGamepadId;
      if (!playerGamepadId || !playerGamepadId[playerId - 1]) {
        return callback(playerId, buttonId);
      }
    };
  };

  private _getPlayerNumberFromGamepad(gamepad: Gamepad): number {
    if (!this.gamepadConfig) return 1;

    if (this.gamepadConfig.playerGamepadId[0] === gamepad.id) return 1;
    if (this.gamepadConfig.playerGamepadId[1] === gamepad.id) return 2;
    return 1;
  }

  poll = () => {
    const gamepads = navigator.getGamepads
      ? navigator.getGamepads()
      : (navigator as any).webkitGetGamepads();

    const usedPlayers: number[] = [];

    for (let gamepadIndex = 0; gamepadIndex < gamepads.length; gamepadIndex++) {
      const gamepad = gamepads[gamepadIndex];
      const previousGamepad = this.gamepadState[gamepadIndex];

      if (!gamepad) continue;

      if (!previousGamepad) {
        this.gamepadState[gamepadIndex] = gamepad;
        continue;
      }

      const buttons = gamepad.buttons;
      const previousButtons = previousGamepad.buttons;

      if (this.buttonCallback) {
        for (let code = 0; code < gamepad.axes.length; code++) {
          const axis = gamepad.axes[code];
          const previousAxis = previousGamepad.axes[code];

          if (axis === -1 && previousAxis !== -1) {
            this.buttonCallback({
              gamepadId: gamepad.id,
              type: "axis",
              code,
              value: axis,
            });
          }

          if (axis === 1 && previousAxis !== 1) {
            this.buttonCallback({
              gamepadId: gamepad.id,
              type: "axis",
              code,
              value: axis,
            });
          }
        }

        for (let code = 0; code < buttons.length; code++) {
          const button = buttons[code];
          const previousButton = previousButtons[code];
          if (button.pressed && !previousButton.pressed) {
            this.buttonCallback({
              gamepadId: gamepad.id,
              type: "button",
              code,
            });
          }
        }
      } else if (this.gamepadConfig) {
        let playerNumber = this._getPlayerNumberFromGamepad(gamepad);
        if (usedPlayers.length < 2) {
          if (usedPlayers.includes(playerNumber)) {
            playerNumber++;
            if (playerNumber > 2) playerNumber = 1;
          }
          usedPlayers.push(playerNumber);

          const config = this.gamepadConfig.configs[gamepad.id];
          if (config) {
            const configButtons = config.buttons;

            for (const configButton of configButtons) {
              if (configButton.type === "button") {
                const { code, buttonId } = configButton;
                const button = buttons[code];
                const previousButton = previousButtons[code];

                if (button.pressed && !previousButton.pressed) {
                  this.onButtonDown(playerNumber, buttonId);
                } else if (!button.pressed && previousButton.pressed) {
                  this.onButtonUp(playerNumber, buttonId);
                }
              } else if (configButton.type === "axis") {
                const { code, value, buttonId } = configButton;
                const axis = gamepad.axes[code];
                const previousAxis = previousGamepad.axes[code];

                if (axis === value && previousAxis !== value) {
                  this.onButtonDown(playerNumber, buttonId);
                }

                if (axis !== value && previousAxis === value) {
                  this.onButtonUp(playerNumber, buttonId);
                }
              }
            }
          }
        }
      }

      this.gamepadState[gamepadIndex] = {
        buttons: buttons.map((b) => ({ pressed: b.pressed })),
        axes: gamepad.axes.slice(0),
      };
    }
  };

  promptButton = (
    f: ((info: ButtonInfo) => void) | null
  ): void => {
    if (!f) {
      this.buttonCallback = f;
    } else {
      this.buttonCallback = (buttonInfo: ButtonInfo) => {
        this.buttonCallback = null;
        f(buttonInfo);
      };
    }
  };

  loadGamepadConfig = (): void => {
    let gamepadConfig: GamepadConfig | undefined;

    try {
      const stored = localStorage.getItem("gamepadConfig");
      if (stored) gamepadConfig = JSON.parse(stored);
    } catch (e) {
      console.log("Failed to get gamepadConfig from localStorage.", e);
    }

    this.gamepadConfig = gamepadConfig;
  };

  setGamepadConfig = (gamepadConfig: GamepadConfig): void => {
    try {
      localStorage.setItem("gamepadConfig", JSON.stringify(gamepadConfig));
      this.gamepadConfig = gamepadConfig;
    } catch (e) {
      console.log("Failed to set gamepadConfig in localStorage");
    }
  };

  startPolling = (): { stop: () => void } => {
    if (!(navigator.getGamepads || (navigator as any).webkitGetGamepads)) {
      return { stop: () => {} };
    }

    let stopped = false;

    const loop = () => {
      if (stopped) return;
      this.poll();
      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);

    return {
      stop: () => {
        stopped = true;
      },
    };
  };
}