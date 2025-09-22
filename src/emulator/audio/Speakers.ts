import RingBuffer from "ringbufferjs";
import { handleError } from "../utils/errorUtils";

type SpeakersOptions = {
  onBufferUnderrun?: (currentSize: number, requiredSize: number) => void;
};

export default class Speakers {
  private bufferSize: number;
  private buffer: RingBuffer<number>;
  private audioCtx: AudioContext | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private onBufferUnderrun?: (currentSize: number, requiredSize: number) => void;

  constructor({ onBufferUnderrun }: SpeakersOptions) {
    this.onBufferUnderrun = onBufferUnderrun;
    this.bufferSize = 8192;
    this.buffer = new RingBuffer(this.bufferSize * 2);
  }

  getSampleRate(): number {
    if (!window.AudioContext) {
      return 44100;
    }
    const myCtx = new window.AudioContext();
    const sampleRate = myCtx.sampleRate;
    myCtx.close();
    return sampleRate;
  }

  start(): void {
    if (!window.AudioContext) return;

    this.audioCtx = new window.AudioContext();
    this.scriptNode = this.audioCtx.createScriptProcessor(1024, 0, 2);
    this.scriptNode.onaudioprocess = this.onaudioprocess;
    this.scriptNode.connect(this.audioCtx.destination);
  }

  stop(): void {
    if (this.scriptNode && this.audioCtx) {
      this.scriptNode.disconnect(this.audioCtx.destination);
      this.scriptNode.onaudioprocess = null;
      this.scriptNode = null;
    }

    if (this.audioCtx) {
      this.audioCtx.close().catch(handleError);
      this.audioCtx = null;
    }
  }

  writeSample = (left: number, right: number): void => {
    if (this.buffer.size() / 2 >= this.bufferSize) {
      console.log("Buffer overrun");
      this.buffer.deqN(this.bufferSize / 2);
    }
    this.buffer.enq(left);
    this.buffer.enq(right);
  };

  onaudioprocess = (e: AudioProcessingEvent): void => {
    const left = e.outputBuffer.getChannelData(0);
    const right = e.outputBuffer.getChannelData(1);
    const size = left.length;

    if (this.buffer.size() < size * 2 && this.onBufferUnderrun) {
      this.onBufferUnderrun(this.buffer.size(), size * 2);
    }

    let samples: number[];

    try {
      samples = this.buffer.deqN(size * 2) as number[];
    } catch {
      const bufferSize = this.buffer.size() / 2;
      if (bufferSize > 0) {
        console.log(`Buffer underrun (needed ${size}, got ${bufferSize})`);
      }
      for (let j = 0; j < size; j++) {
        left[j] = 0;
        right[j] = 0;
      }
      return;
    }

    for (let i = 0; i < size; i++) {
      left[i] = samples[i * 2];
      right[i] = samples[i * 2 + 1];
    }
  };
}