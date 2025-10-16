import { useState, useEffect, useCallback } from 'react';

interface FullscreenAPI {
  supportsNativeFS: () => boolean;
  isNativeFS: () => boolean;
  enterNativeFS: (element: HTMLElement) => Promise<void>;
  exitNativeFS: () => Promise<void>;
  onFSChange: (callback: () => void) => () => void;
  canLockOrientation: () => boolean;
  lockLandscapeIfSupported: () => Promise<void>;
  unlockOrientationSafe: () => void;
}

export function useFullscreen(): FullscreenAPI & { isFullscreenUI: boolean; setIsFullscreenUI: (value: boolean) => void } {
  const [isFullscreenUI, setIsFullscreenUI] = useState(false);

  // Check if native fullscreen is supported
  const supportsNativeFS = useCallback((): boolean => {
    const doc = document as Document & {
      webkitFullscreenEnabled?: boolean;
      mozFullScreenEnabled?: boolean;
      msFullscreenEnabled?: boolean;
    };
    return !!(
      document.fullscreenEnabled ||
      doc.webkitFullscreenEnabled ||
      doc.mozFullScreenEnabled ||
      doc.msFullscreenEnabled
    );
  }, []);

  // Check if currently in native fullscreen
  const isNativeFS = useCallback((): boolean => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      mozFullScreenElement?: Element;
      msFullscreenElement?: Element;
    };
    return !!(
      document.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );
  }, []);

  // Enter native fullscreen
  const enterNativeFS = useCallback(async (element: HTMLElement): Promise<void> => {
    const el = element as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
      mozRequestFullScreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };
    const requestFS =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.mozRequestFullScreen ||
      el.msRequestFullscreen;

    if (requestFS) {
      try {
        await requestFS.call(element);
      } catch (error) {
        console.warn('[useFullscreen] Failed to enter native fullscreen:', error);
        throw error;
      }
    } else {
      throw new Error('Native fullscreen not supported');
    }
  }, []);

  // Exit native fullscreen
  const exitNativeFS = useCallback(async (): Promise<void> => {
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void>;
      mozCancelFullScreen?: () => Promise<void>;
      msExitFullscreen?: () => Promise<void>;
    };
    const exitFS =
      document.exitFullscreen ||
      doc.webkitExitFullscreen ||
      doc.mozCancelFullScreen ||
      doc.msExitFullscreen;

    if (exitFS) {
      try {
        await exitFS.call(document);
      } catch (error) {
        console.warn('[useFullscreen] Failed to exit native fullscreen:', error);
        throw error;
      }
    }
  }, []);

  // Listen for fullscreen changes
  const onFSChange = useCallback((callback: () => void): (() => void) => {
    const events = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
      'MSFullscreenChange'
    ];

    events.forEach(event => document.addEventListener(event, callback));

    return () => {
      events.forEach(event => document.removeEventListener(event, callback));
    };
  }, []);

  // Check if orientation lock is supported
  const canLockOrientation = useCallback((): boolean => {
    const orientation = (screen as Screen & {
      orientation?: {
        lock?: (orientation: string) => Promise<void>;
        unlock?: () => void;
      };
    }).orientation;
    return !!(orientation && typeof orientation.lock === 'function');
  }, []);

  // Lock to landscape orientation if supported
  const lockLandscapeIfSupported = useCallback(async (): Promise<void> => {
    if (canLockOrientation()) {
      try {
        const orientation = (screen as Screen & {
          orientation?: {
            lock?: (orientation: string) => Promise<void>;
          };
        }).orientation;
        if (orientation?.lock) {
          await orientation.lock('landscape');
        }
      } catch (error) {
        console.warn('[useFullscreen] Failed to lock orientation:', error);
        // Don't throw - orientation lock is optional
      }
    }
  }, [canLockOrientation]);

  // Safely unlock orientation
  const unlockOrientationSafe = useCallback((): void => {
    try {
      const orientation = (screen as Screen & {
        orientation?: {
          unlock?: () => void;
        };
      }).orientation;
      if (orientation && typeof orientation.unlock === 'function') {
        orientation.unlock();
      }
    } catch (error) {
      console.warn('[useFullscreen] Failed to unlock orientation:', error);
      // Don't throw - orientation unlock is optional
    }
  }, []);

  // Handle scroll lock based on fullscreen UI state
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    if (isFullscreenUI) {
      html.classList.add('no-scroll');
      body.classList.add('no-scroll');
    } else {
      html.classList.remove('no-scroll');
      body.classList.remove('no-scroll');
    }

    // Cleanup on unmount
    return () => {
      html.classList.remove('no-scroll');
      body.classList.remove('no-scroll');
    };
  }, [isFullscreenUI]);

  return {
    isFullscreenUI,
    setIsFullscreenUI,
    supportsNativeFS,
    isNativeFS,
    enterNativeFS,
    exitNativeFS,
    onFSChange,
    canLockOrientation,
    lockLandscapeIfSupported,
    unlockOrientationSafe
  };
}