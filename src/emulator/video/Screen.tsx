import React, { Component, MouseEvent } from "react";
import "./Screen.css";

const SCREEN_WIDTH = 256;
const SCREEN_HEIGHT = 240;

type ScreenProps = {
  onGenerateFrame?: () => void;
  onMouseDown?: (x: number, y: number) => void;
  onMouseUp?: () => void;
};

export default class Screen extends Component<ScreenProps> {
  private canvas: HTMLCanvasElement | null = null;
  private canvasContext!: CanvasRenderingContext2D;
  private imageData!: ImageData;
  private buf!: ArrayBuffer;
  private buf8!: Uint8ClampedArray;
  private buf32!: Uint32Array;

  render() {
    return (
      <canvas
        className="Screen"
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        onMouseDown={this.handleMouseDown}
        onMouseUp={this.props.onMouseUp}
        ref={(canvas) => {
          this.canvas = canvas;
        }}
      />
    );
  }

  componentDidMount() {
    this.initCanvas();
  }

  componentDidUpdate() {
    this.initCanvas();
  }

  initCanvas() {
    if (!this.canvas) return;

    const context = this.canvas.getContext("2d");
    if (!context) return;

    this.canvasContext = context;
    this.imageData = context.getImageData(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    this.canvasContext.fillStyle = "black";
    this.canvasContext.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    this.buf = new ArrayBuffer(this.imageData.data.length);
    this.buf8 = new Uint8ClampedArray(this.buf);
    this.buf32 = new Uint32Array(this.buf);

    for (let i = 0; i < this.buf32.length; ++i) {
      this.buf32[i] = 0xff000000;
    }
  }

  setBuffer = (buffer: Uint32Array) => {
    let i = 0;
    for (let y = 0; y < SCREEN_HEIGHT; ++y) {
      for (let x = 0; x < SCREEN_WIDTH; ++x) {
        i = y * SCREEN_WIDTH + x;
        this.buf32[i] = 0xff000000 | buffer[i];
      }
    }
  };

  writeBuffer = () => {
    this.imageData.data.set(this.buf8);
    this.canvasContext.putImageData(this.imageData, 0, 0);
  };

  fitInParent = () => {
    if (!this.canvas || !this.canvas.parentElement) return;

    const parent = this.canvas.parentElement;
    const parentWidth = parent.clientWidth;
    const parentHeight = parent.clientHeight;
    const parentRatio = parentWidth / parentHeight;
    const desiredRatio = SCREEN_WIDTH / SCREEN_HEIGHT;

    if (desiredRatio < parentRatio) {
      this.canvas.style.width = `${Math.round(parentHeight * desiredRatio)}px`;
      this.canvas.style.height = `${parentHeight}px`;
    } else {
      this.canvas.style.width = `${parentWidth}px`;
      this.canvas.style.height = `${Math.round(parentWidth / desiredRatio)}px`;
    }
  };

  screenshot(): HTMLImageElement {
    const img = new Image();
    if (this.canvas) {
      img.src = this.canvas.toDataURL("image/png");
    }
    return img;
  }

  handleMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!this.props.onMouseDown || !this.canvas) return;

    const scale = SCREEN_WIDTH / parseFloat(this.canvas.style.width);
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * scale);
    const y = Math.round((e.clientY - rect.top) * scale);
    this.props.onMouseDown(x, y);
  };
}