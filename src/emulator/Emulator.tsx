import React, { Component } from "react";
import { NES } from "jsnes";

import FrameTimer from "./utils/FrameTimer";
import GamepadController from "./controllers/GamepadController";
import KeyboardController from "./controllers/KeyboardController";
import Screen from "./video/Screen";
import Speakers from "./audio/Speakers";

interface EmulatorProps {
  paused?: boolean;
  romData: string;
  muted?: boolean;
}

class Emulator extends Component<EmulatorProps> {
  screen: any;
  speakers: any;
  nes: NES;
  frameTimer: any;
  gamepadController: any;
  keyboardController: any;
  gamepadPolling: any;
  fpsInterval: NodeJS.Timeout;

  render() {
    return (
      <Screen
        ref={(screen: any) => {
          this.screen = screen;
        }}
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
    this.fitInParent();

    this.speakers = new Speakers({
      onBufferUnderrun: (actualSize: number, desiredSize: number) => {
        if (this.props.paused) return;

        console.log("Buffer underrun, running another frame to try and catch up");
        this.frameTimer.generateFrame();

        if (this.speakers.buffer.size() < desiredSize) {
          console.log("Still buffer underrun, running a second frame");
          this.frameTimer.generateFrame();
        }
      },
    });

    this.nes = new NES({
      onFrame: this.screen.setBuffer,
      onStatusUpdate: console.log,
      onAudioSample: this.speakers.writeSample,
      sampleRate: this.speakers.getSampleRate(),
    });

    (window as any)["nes"] = this.nes;

    this.frameTimer = new FrameTimer({
      onGenerateFrame: this.nes.frame,
      onWriteFrame: this.screen.writeBuffer,
    });

    this.gamepadController = new GamepadController({
      onButtonDown: this.nes.buttonDown,
      onButtonUp: this.nes.buttonUp,
    });
    this.gamepadController.loadGamepadConfig();
    this.gamepadPolling = this.gamepadController.startPolling();

    this.keyboardController = new KeyboardController({
      onButtonDown: this.gamepadController.disableIfGamepadEnabled(this.nes.buttonDown),
      onButtonUp: this.gamepadController.disableIfGamepadEnabled(this.nes.buttonUp),
    });
    this.keyboardController.loadKeys();

    document.addEventListener("keydown", this.keyboardController.handleKeyDown);
    document.addEventListener("keyup", this.keyboardController.handleKeyUp);
    document.addEventListener("keypress", this.keyboardController.handleKeyPress);

    this.nes.loadROM(this.props.romData);
    this.start();
  }

  componentWillUnmount() {
    this.stop();

    document.removeEventListener("keydown", this.keyboardController.handleKeyDown);
    document.removeEventListener("keyup", this.keyboardController.handleKeyUp);
    document.removeEventListener("keypress", this.keyboardController.handleKeyPress);

    this.gamepadPolling.stop();
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
          this.speakers.stop();
        } else if (!this.props.paused) {
          this.speakers.start();
        }
      }
    }
  }

  start = () => {
    this.frameTimer.start();
    this.speakers.start();
    this.fpsInterval = setInterval(() => {
      console.log(`FPS: ${this.nes.getFPS()}`);
    }, 1000);
  };

  stop = () => {
    this.frameTimer.stop();
    this.speakers.stop();
    clearInterval(this.fpsInterval);
  };

  fitInParent() {
    this.screen.fitInParent();
  }
}

export default Emulator;
