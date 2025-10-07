import React, { Component, MouseEvent } from "react";
import "./Screen.css";

const SCREEN_WIDTH = 256;
const SCREEN_HEIGHT = 240;

type ScreenProps = {
  onGenerateFrame?: () => void;
  onMouseDown?: (x: number, y: number) => void;
  onMouseUp?: () => void;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
};

export default class Screen extends Component<ScreenProps> {
  private canvas: HTMLCanvasElement | null = null;
  private canvasContext!: CanvasRenderingContext2D;
  private imageData!: ImageData;
  private buf!: ArrayBuffer;
  private buf8!: Uint8ClampedArray;
  private buf32!: Uint32Array;
  private fullscreenCleanup: (() => void) | null = null;

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
          if (this.props.canvasRef) {
            (this.props.canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = canvas;
          }
        }}
      />
    );
  }

  componentDidMount() {
    // Use requestAnimationFrame to ensure DOM is ready before initialization
    requestAnimationFrame(() => {
      this.initCanvas();
    });

    // Handle fullscreen changes
    const handleFullscreenChange = () => {
      // Use requestAnimationFrame to ensure DOM dimensions are updated
      requestAnimationFrame(() => {
        setTimeout(() => this.fitInParent(), 100);
      });
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Store cleanup function
    this.fullscreenCleanup = () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }

  componentDidUpdate() {
    // Only reinitialize canvas if the canvas element has actually changed
    // This prevents unnecessary DOM operations that could cause sync issues
    if (!this.canvasContext || !this.imageData) {
      requestAnimationFrame(() => {
        this.initCanvas();
      });
    }
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
    // Use requestAnimationFrame to ensure DOM is ready and prevent sync issues
    requestAnimationFrame(() => {
      if (!this.canvas || !this.canvas.parentElement) {
        return;
      }

      // Double-check that the canvas is still in the DOM
      if (!document.body.contains(this.canvas)) {
        console.warn('[Screen] Canvas is no longer in DOM, skipping fitInParent');
        return;
      }

      const parent = this.canvas.parentElement;
      const parentWidth = parent.clientWidth;
      const parentHeight = parent.clientHeight;

      // Scale factor for better sizing (2.5x scale for 640x600 pixels on desktop)
      const scaleFactor = 2.5;
      const scaledWidth = SCREEN_WIDTH * scaleFactor;
      const scaledHeight = SCREEN_HEIGHT * scaleFactor;

      // Check if we're in fullscreen mode
      const isFullscreen = !!document.fullscreenElement;

      let targetWidth, targetHeight;

      if (isFullscreen) {
        // In fullscreen, use maximum available space for immersive experience
        const fullscreenScale = Math.min(
          (parentWidth - 80) / SCREEN_WIDTH,   // Leave more padding for clean look
          (parentHeight - 80) / SCREEN_HEIGHT  // Leave more padding for clean look
        );
        targetWidth = Math.round(SCREEN_WIDTH * fullscreenScale);
        targetHeight = Math.round(SCREEN_HEIGHT * fullscreenScale);
      } else {
        // Normal mode - use 2.5x scale but ensure it fits
        targetWidth = scaledWidth;
        targetHeight = scaledHeight;

        // If scaled size is too big for parent, scale it down
        if (targetWidth > parentWidth || targetHeight > parentHeight) {
          const widthScale = parentWidth / scaledWidth;
          const heightScale = parentHeight / scaledHeight;
          const minScale = Math.min(widthScale, heightScale);

          targetWidth = Math.round(scaledWidth * minScale);
          targetHeight = Math.round(scaledHeight * minScale);
        }
      }

      // Only update styles if they've actually changed to prevent unnecessary DOM operations
      const currentWidth = parseInt(this.canvas.style.width) || 0;
      const currentHeight = parseInt(this.canvas.style.height) || 0;

      if (currentWidth !== targetWidth || currentHeight !== targetHeight) {
        this.canvas.style.width = `${targetWidth}px`;
        this.canvas.style.height = `${targetHeight}px`;
        this.canvas.style.margin = 'auto';
        this.canvas.style.display = 'block';
      }
    });
  };

  componentWillUnmount() {
    // Cleanup fullscreen event listeners
    if (this.fullscreenCleanup) {
      this.fullscreenCleanup();
    }
  }

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