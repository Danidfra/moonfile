import React, { Component } from "react";
import { NES } from "jsnes";

import FrameTimer from "./utils/FrameTimer";
import GamepadController from "./controllers/GamepadController";
import KeyboardController from "./controllers/KeyboardController";
import Screen from "./video/Screen";
import Speakers from "./audio/Speakers";

interface ScreenRef {
  setBuffer: (buffer: Uint32Array) => void;
  writeBuffer: () => void;
  fitInParent: () => void;
}

interface _SpeakersRef {
  writeSample: (left: number, right: number) => void;
  getSampleRate: () => number;
  start: () => void;
  stop: () => void;
  buffer: unknown;
}

interface FrameTimerRef {
  start: () => void;
  stop: () => void;
  generateFrame: () => void;
}

interface GamepadControllerRef {
  loadGamepadConfig: () => void;
  startPolling: () => { stop: () => void };
  disableIfGamepadEnabled: (callback: (playerId: number, buttonId: number) => void) => (playerId: number, buttonId: number) => void;
}

interface KeyboardControllerRef {
  loadKeys: () => void;
  handleKeyDown: (e: KeyboardEvent) => void;
  handleKeyUp: (e: KeyboardEvent) => void;
  handleKeyPress: (e: KeyboardEvent) => void;
}

interface EmulatorProps {
  paused?: boolean;
  romData: string;
  muted?: boolean;
}

interface EmulatorMethods {
  getCanvasStream: () => MediaStream | null;
}

class Emulator extends Component<EmulatorProps> {
  private canvasRef: React.RefObject<HTMLCanvasElement> = React.createRef();
  screen: ScreenRef | null;
  speakers: unknown | null;
  nes: NES;
  frameTimer: FrameTimerRef | null;
  gamepadController: GamepadControllerRef | null;
  keyboardController: KeyboardControllerRef | null;
  gamepadPolling: { stop: () => void } | null;
  fpsInterval: NodeJS.Timeout | null;

  render() {
    return (
      <Screen
        ref={(screen: Screen) => {
          this.screen = screen;
        }}
        canvasRef={this.canvasRef}
        onGenerateFrame={() => {
          this.nes.frame();
        }}
        onMouseDown={(x: number, y: number) => {
          this.nes.zapperMove(x, y);
          this.nes.zapperFireDown();
        }}
        onMouseUp={() => {
          this.nes.zapperFireUp();
        }}
      />
    );
  }

  componentDidMount() {
    const mountStartTime = performance.now();
    console.log('[Emulator] ⏱️ Component mounting started at:', new Date().toISOString());

    this.fitInParent();

    const speakersStartTime = performance.now();
    console.log('[Emulator] 🎵 Creating Speakers...');
    this.speakers = new Speakers({
      onBufferUnderrun: (actualSize: number, desiredSize: number) => {
        if (this.props.paused) return;

        console.log("Buffer underrun, running another frame to try and catch up");
        if (this.frameTimer) {
          this.frameTimer.generateFrame();
        }

        if (this.speakers && (this.speakers as any).buffer.size() < desiredSize) {
          console.log("Still buffer underrun, running a second frame");
          if (this.frameTimer) {
            this.frameTimer.generateFrame();
          }
        }
      },
    });

    const nesStartTime = performance.now();
    console.log('[Emulator] 🕹️ Creating NES instance...');
    this.nes = new NES({
      onFrame: this.screen ? this.screen.setBuffer : () => {},
      onStatusUpdate: console.log,
      onAudioSample: this.speakers ? this.speakers.writeSample : () => {},
      sampleRate: this.speakers ? this.speakers.getSampleRate() : 44100,
    });

    (window as unknown as Record<string, unknown>)["nes"] = this.nes;
    console.log('[Emulator] ⏱️ NES instance created in:', performance.now() - nesStartTime, 'ms');

    this.frameTimer = new FrameTimer({
      onGenerateFrame: this.nes.frame,
      onWriteFrame: this.screen ? this.screen.writeBuffer : () => {},
    });

    this.gamepadController = new GamepadController({
      onButtonDown: this.nes.buttonDown,
      onButtonUp: this.nes.buttonUp,
    });
    this.gamepadController.loadGamepadConfig();
    this.gamepadPolling = this.gamepadController.startPolling();

    this.keyboardController = new KeyboardController({
      onButtonDown: this.gamepadController ? this.gamepadController.disableIfGamepadEnabled(this.nes.buttonDown) : this.nes.buttonDown,
      onButtonUp: this.gamepadController ? this.gamepadController.disableIfGamepadEnabled(this.nes.buttonUp) : this.nes.buttonUp,
    });
    this.keyboardController.loadKeys();

    document.addEventListener("keydown", this.keyboardController.handleKeyDown);
    document.addEventListener("keyup", this.keyboardController.handleKeyUp);
    document.addEventListener("keypress", this.keyboardController.handleKeyPress);

    const romLoadStartTime = performance.now();
    console.log('[Emulator] 📀 Loading ROM data...');
    console.log('[Emulator] 📊 ROM data size:', this.props.romData.length, 'characters');

    this.nes.loadROM(this.props.romData);

    const romLoadEndTime = performance.now();
    console.log('[Emulator] ⏱️ ROM loading completed in:', romLoadEndTime - romLoadStartTime, 'ms');

    const startStartTime = performance.now();
    console.log('[Emulator] ▶️ Starting emulator...');
    this.start();

    const totalMountTime = performance.now() - mountStartTime;
    console.log('[Emulator] ⏱️ Total componentDidMount time:', totalMountTime, 'ms');
  }

  componentWillUnmount() {
    this.stop();

    if (this.keyboardController) {
      document.removeEventListener("keydown", this.keyboardController.handleKeyDown);
      document.removeEventListener("keyup", this.keyboardController.handleKeyUp);
      document.removeEventListener("keypress", this.keyboardController.handleKeyPress);
    }

    if (this.gamepadPolling) {
      this.gamepadPolling.stop();
    }
    (window as any)["nes"] = undefined;
  }

  componentDidUpdate(prevProps: EmulatorProps) {
    if (this.props.paused !== prevProps.paused) {
      if (this.props.paused) {
        this.stop();
      } else {
        this.start();
      }
    }

    if (this.props.muted !== prevProps.muted) {
      if (this.speakers) {
        if (this.props.muted) {
          (this.speakers as any).stop();
        } else if (!this.props.paused) {
          (this.speakers as any).start();
        }
      }
    }
  }

  start = () => {
    if (this.frameTimer) {
      this.frameTimer.start();
    }
    if (this.speakers) {
      (this.speakers as any).start();
    }
    this.fpsInterval = setInterval(() => {
      console.log(`FPS: ${this.nes.getFPS()}`);
    }, 1000);
  };

  stop = () => {
    if (this.frameTimer) {
      this.frameTimer.stop();
    }
    if (this.speakers) {
      (this.speakers as any).stop();
    }
    if (this.fpsInterval) {
      clearInterval(this.fpsInterval);
      this.fpsInterval = null;
    }
  };

  fitInParent() {
    if (this.screen) {
      this.screen.fitInParent();
    }
  }

  getCanvasStream = (): MediaStream | null => {
    console.log('[Emulator] 📹 getCanvasStream called at:', new Date().toISOString());

    if (this.canvasRef.current) {
      try {
        console.log('[Emulator] 📹 Canvas found, capturing stream at 30 FPS');
        const stream = this.canvasRef.current.captureStream(30);
        console.log('[Emulator] ✅ Canvas stream captured successfully:', {
          id: stream.id,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        });
        return stream;
      } catch (error) {
        console.error('[Emulator] ❌ Failed to capture canvas stream:', error);
        return null;
      }
    } else {
      console.warn('[Emulator] ❌ Canvas ref not available for stream capture');
      return null;
    }
  };
}

export default Emulator;
