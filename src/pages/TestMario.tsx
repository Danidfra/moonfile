/**
 * Test Mario Page
 * 
 * Test page for the NES emulator using the jsnes-based player component.
 * Loads and plays Super Mario Bros using the NesPlayer component.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import NesPlayer from '@/components/NesPlayer';

export default function TestMario() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Super Mario Bros Test</h1>
                <p className="text-sm text-muted-foreground">
                  Testing the jsnes-based NES emulator
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Game Player */}
          <NesPlayer 
            romPath="/roms/Super_mario_brothers.nes"
            title="Super Mario Bros"
            className="w-full"
          />

          {/* Information */}
          <Card>
            <CardHeader>
              <CardTitle>Test Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">ROM Details</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• File: /public/roms/Super_mario_brothers.nes</li>
                    <li>• Size: ~40KB</li>
                    <li>• Mapper: NROM (0)</li>
                    <li>• Format: iNES</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Emulator Details</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Engine: jsnes (JavaScript NES emulator)</li>
                    <li>• Audio: Web Audio API</li>
                    <li>• Video: HTML5 Canvas</li>
                    <li>• Input: Keyboard + Gamepad support</li>
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">How to Play</h4>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>
                    Use the keyboard controls shown above the game screen to play. 
                    The game should start automatically when loaded. Use the control 
                    buttons below the game screen to pause, resume, or reset.
                  </p>
                  <p>
                    This test demonstrates the integration of the jsnes emulator 
                    with React components, providing a complete NES gaming experience 
                    in the browser.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Link
                  to="https://soapbox.pub/mkstack"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Vibed with MKStack
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}