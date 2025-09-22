const FPS = 60.098;

interface FrameTimerProps {
  onGenerateFrame: () => void;
  onWriteFrame: () => void;
}

export default class FrameTimer {
  private onGenerateFrame: () => void;
  private onWriteFrame: () => void;
  private _requestID?: number;
  private interval: number;
  private lastFrameTime: number | false;
  private running: boolean;

  constructor(props: FrameTimerProps) {
    this.onGenerateFrame = props.onGenerateFrame;
    this.onWriteFrame = props.onWriteFrame;
    this.onAnimationFrame = this.onAnimationFrame.bind(this);
    this.running = true;
    this.interval = 1000 / FPS;
    this.lastFrameTime = false;
  }

  start() {
    this.running = true;
    this.requestAnimationFrame();
  }

  stop() {
    this.running = false;
    if (this._requestID !== undefined) {
      window.cancelAnimationFrame(this._requestID);
    }
    this.lastFrameTime = false;
  }

  private requestAnimationFrame() {
    this._requestID = window.requestAnimationFrame(this.onAnimationFrame);
  }

  generateFrame() {
    this.onGenerateFrame();
    if (typeof this.lastFrameTime === 'number') {
      this.lastFrameTime += this.interval;
    }
  }

  private onAnimationFrame = (time: number) => {
    this.requestAnimationFrame();

    const excess = time % this.interval;
    const newFrameTime = time - excess;

    if (!this.lastFrameTime) {
      this.lastFrameTime = newFrameTime;
      return;
    }

    const numFrames = Math.round(
      (newFrameTime - this.lastFrameTime) / this.interval
    );

    if (numFrames === 0) return;

    this.generateFrame();
    this.onWriteFrame();

    const timeToNextFrame = this.interval - excess;
    for (let i = 1; i < numFrames; i++) {
      setTimeout(() => {
        this.generateFrame();
      }, (i * timeToNextFrame) / numFrames);
    }

    if (numFrames > 1) {
      console.log("SKIP", numFrames - 1, this.lastFrameTime);
    }
  };
}