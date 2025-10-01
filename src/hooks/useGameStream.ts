import { useRef, useCallback, useEffect } from 'react';

export interface GameStreamOptions {
  width?: number;
  height?: number;
  frameRate?: number;
}

export function useGameStream(options: GameStreamOptions = {}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const {
    width = 256,
    height = 240,
    frameRate = 60
  } = options;

  /**
   * Start capturing video stream from a canvas element
   */
  const startStream = useCallback((canvas: HTMLCanvasElement): MediaStream | null => {
    try {
      canvasRef.current = canvas;
      
      // Capture stream from canvas
      const stream = canvas.captureStream(frameRate);
      streamRef.current = stream;
      
      console.log('[GameStream] Started capturing stream from canvas');
      return stream;
      
    } catch (error) {
      console.error('[GameStream] Failed to start stream:', error);
      return null;
    }
  }, [frameRate]);

  /**
   * Stop the video stream
   */
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    canvasRef.current = null;
    console.log('[GameStream] Stopped video stream');
  }, []);

  /**
   * Get current stream
   */
  const getStream = useCallback((): MediaStream | null => {
    return streamRef.current;
  }, []);

  /**
   * Check if stream is active
   */
  const isStreaming = useCallback((): boolean => {
    return streamRef.current?.active || false;
  }, []);

  /**
   * Create a video element that receives a remote stream
   */
  const createVideoElement = useCallback((stream: MediaStream): HTMLVideoElement => {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = false; // Allow audio for guests
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'contain';
    
    return video;
  }, []);

  /**
   * Set up a video element to display a remote stream
   */
  const setupRemoteVideo = useCallback((videoElement: HTMLVideoElement, stream: MediaStream) => {
    videoElement.srcObject = stream;
    
    videoElement.onloadedmetadata = () => {
      videoElement.play().catch(err => {
        console.error('[GameStream] Failed to play remote video:', err);
      });
    };

    console.log('[GameStream] Set up remote video element');
  }, []);

  /**
   * Clean up on unmount
   */
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return {
    startStream,
    stopStream,
    getStream,
    isStreaming,
    createVideoElement,
    setupRemoteVideo
  };
}