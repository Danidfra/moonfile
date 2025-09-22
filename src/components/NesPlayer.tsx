/**
 * NES Player Component
 *
 * React component that uses jsnes-based Emulator to play NES games.
 * Loads ROM data and provides play/pause controls.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import Emulator from '@/emulator/Emulator';

interface NesPlayerProps {
  romPath: string; // Now this is the actual binary string data, not a URL
  title?: string;
  className?: string;
}

export default function NesPlayer({ romPath, title = "NES Game", className = "" }: NesPlayerProps) {
  const [isReady, setIsReady] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emulatorKey, setEmulatorKey] = useState(0); // For forcing re-mount

  // Validate NES ROM header
  const validateNesHeader = (data: string): boolean => {
    console.log('[NesPlayer] Validating NES header...');

    // Check minimum length
    if (data.length < 16) {
      console.error('[NesPlayer] ROM too short for NES header');
      return false;
    }

    // Check NES magic bytes
    const nesMagic = data.substring(0, 4);
    const expectedMagic = 'NES\x1a';

    if (nesMagic !== expectedMagic) {
      console.error('[NesPlayer] Invalid NES magic bytes:', {
        actual: Array.from(nesMagic).map(c => c.charCodeAt(0).toString(16)),
        expected: Array.from(expectedMagic).map(c => c.charCodeAt(0).toString(16))
      });
      return false;
    }

    // Log ROM info
    const prgBanks = data.charCodeAt(4);
    const chrBanks = data.charCodeAt(5);
    const mapper = (data.charCodeAt(6) >> 4) | (data.charCodeAt(7) & 0xF0);

    console.log('[NesPlayer] ROM validation passed:', {
      prgBanks,
      chrBanks,
      mapper,
      totalSize: data.length
    });

    return true;
  };

  // Process ROM data on component mount
  useEffect(() => {
    const processRom = () => {
      try {
        console.log('[NesPlayer] Processing ROM data...');
        setError(null);

        // Validate that we have ROM data
        if (!romPath || typeof romPath !== 'string') {
          throw new Error('No ROM data provided');
        }

        console.log(`[NesPlayer] ROM data length: ${romPath.length} characters`);

        // Validate ROM header
        if (!validateNesHeader(romPath)) {
          throw new Error('Not a valid NES ROM file');
        }

        console.log('[NesPlayer] ROM validation passed, ready to play');
        setIsReady(true);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to process ROM data';
        console.error('[NesPlayer] ROM processing error:', errorMessage);
        setError(errorMessage);
      }
    };

    processRom();
  }, [romPath]);

  const handlePlayPause = () => {
    setIsPaused(!isPaused);
  };

  const handleReset = () => {
    // Force remount of emulator component to reset game
    setEmulatorKey(prev => prev + 1);
    setIsPaused(false);
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    // Note: Audio muting would need to be implemented in Emulator component
    console.log(`[NesPlayer] Audio ${isMuted ? 'unmuted' : 'muted'}`);
  };

  if (error) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <Card className="w-full max-w-4xl border-destructive">
          <CardContent className="p-8 text-center">
            <div className="text-destructive text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-destructive mb-2">Error Loading Game</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <Card className="w-full max-w-4xl">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Processing {title}...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      {/* Game Title */}
      <Card className="w-full max-w-4xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-center">{title}</CardTitle>
        </CardHeader>
      </Card>

      {/* Game Display */}
      <Card className="w-full max-w-4xl bg-black border-2">
        <CardContent className="p-4">
          <div
            className="relative bg-black rounded-lg overflow-hidden"
            style={{ aspectRatio: '256/240' }}
          >
            <Emulator
              key={emulatorKey}
              romData={romPath}
              paused={isPaused}
            />
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <Card className="w-full max-w-4xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-4">
            <Button
              onClick={handlePlayPause}
              variant={isPaused ? "default" : "secondary"}
              size="lg"
            >
              {isPaused ? <Play className="w-5 h-5 mr-2" /> : <Pause className="w-5 h-5 mr-2" />}
              {isPaused ? 'Play' : 'Pause'}
            </Button>

            <Button
              onClick={handleReset}
              variant="outline"
              size="lg"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Reset
            </Button>

            <Button
              onClick={handleMuteToggle}
              variant="ghost"
              size="lg"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className={`w-2 h-2 rounded-full ${
                isPaused ? 'bg-yellow-500' : 'bg-green-500'
              }`}></div>
              {isPaused ? 'Paused' : 'Running'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controls Help */}
      <Card className="w-full max-w-4xl">
        <CardContent className="p-4">
          <div className="text-center space-y-2">
            <h4 className="font-semibold text-sm">Keyboard Controls</h4>
            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
              <div className="space-y-1">
                <div><kbd className="px-2 py-1 bg-muted rounded text-xs">↑ ↓ ← →</kbd> D-Pad</div>
                <div><kbd className="px-2 py-1 bg-muted rounded text-xs">Enter</kbd> Start</div>
              </div>
              <div className="space-y-1">
                <div><kbd className="px-2 py-1 bg-muted rounded text-xs">Shift</kbd> Select</div>
                <div><kbd className="px-2 py-1 bg-muted rounded text-xs">Z</kbd> B Button | <kbd className="px-2 py-1 bg-muted rounded text-xs">X</kbd> A Button</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}