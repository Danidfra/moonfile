import { describe, it, expect } from 'vitest';
import { 
  getGameMimeType, 
  getSystemNameFromMimeType, 
  isSupportedMimeType,
  isMultiplayerGame,
  getMaxPlayers 
} from './gameUtils';
import type { NostrEvent } from '@jsr/nostrify__nostrify';

describe('gameUtils', () => {
  const createMockEvent = (tags: string[][]): NostrEvent => ({
    id: 'test-id',
    pubkey: 'test-pubkey',
    created_at: Date.now(),
    kind: 31996,
    tags,
    content: 'test-content',
    sig: 'test-sig'
  });

  describe('getGameMimeType', () => {
    it('should return MIME type from event tags', () => {
      const event = createMockEvent([
        ['d', 'test-game'],
        ['mime', 'application/x-snes-rom']
      ]);

      expect(getGameMimeType(event)).toBe('application/x-snes-rom');
    });

    it('should return default NES MIME type when no mime tag exists', () => {
      const event = createMockEvent([
        ['d', 'test-game'],
        ['name', 'Test Game']
      ]);

      expect(getGameMimeType(event)).toBe('application/x-nes-rom');
    });

    it('should return default when mime tag is empty', () => {
      const event = createMockEvent([
        ['d', 'test-game'],
        ['mime', '']
      ]);

      expect(getGameMimeType(event)).toBe('application/x-nes-rom');
    });
  });

  describe('getSystemNameFromMimeType', () => {
    it('should return correct system names for known MIME types', () => {
      expect(getSystemNameFromMimeType('application/x-nes-rom')).toBe('Nintendo Entertainment System');
      expect(getSystemNameFromMimeType('application/x-snes-rom')).toBe('Super Nintendo Entertainment System');
      expect(getSystemNameFromMimeType('application/x-gameboy-rom')).toBe('Game Boy');
      expect(getSystemNameFromMimeType('application/x-gba-rom')).toBe('Game Boy Advance');
      expect(getSystemNameFromMimeType('application/x-genesis-rom')).toBe('Sega Genesis');
      expect(getSystemNameFromMimeType('application/x-playstation-rom')).toBe('Sony PlayStation');
    });

    it('should return "Unknown System" for unknown MIME types', () => {
      expect(getSystemNameFromMimeType('application/x-unknown-rom')).toBe('Unknown System');
      expect(getSystemNameFromMimeType('invalid-mime-type')).toBe('Unknown System');
    });

    it('should handle alternative MIME type formats', () => {
      expect(getSystemNameFromMimeType('application/x-nintendo-nes-rom')).toBe('Nintendo Entertainment System');
      expect(getSystemNameFromMimeType('application/x-nintendo-snes-rom')).toBe('Super Nintendo Entertainment System');
      expect(getSystemNameFromMimeType('application/x-sega-genesis-rom')).toBe('Sega Genesis');
    });
  });

  describe('isSupportedMimeType', () => {
    it('should return true for supported MIME types', () => {
      const supportedTypes = [
        'application/x-nes-rom',
        'application/x-snes-rom',
        'application/x-gameboy-rom',
        'application/x-gba-rom',
        'application/x-genesis-rom',
        'application/x-playstation-rom',
        'application/x-n64-rom',
        'application/x-atari-2600-rom'
      ];

      supportedTypes.forEach(mimeType => {
        expect(isSupportedMimeType(mimeType)).toBe(true);
      });
    });

    it('should return false for unsupported MIME types', () => {
      const unsupportedTypes = [
        'application/x-unknown-rom',
        'application/octet-stream',
        'text/plain',
        'image/jpeg',
        'invalid-mime-type'
      ];

      unsupportedTypes.forEach(mimeType => {
        expect(isSupportedMimeType(mimeType)).toBe(false);
      });
    });

    it('should support alternative MIME type formats', () => {
      expect(isSupportedMimeType('application/x-nintendo-nes-rom')).toBe(true);
      expect(isSupportedMimeType('application/x-nintendo-snes-rom')).toBe(true);
      expect(isSupportedMimeType('application/x-sega-genesis-rom')).toBe(true);
    });
  });

  describe('existing multiplayer functions', () => {
    it('should detect multiplayer games correctly', () => {
      const multiplayerEvent = createMockEvent([
        ['d', 'test-game'],
        ['mode', 'multiplayer']
      ]);

      const singleplayerEvent = createMockEvent([
        ['d', 'test-game'],
        ['mode', 'singleplayer']
      ]);

      expect(isMultiplayerGame(multiplayerEvent)).toBe(true);
      expect(isMultiplayerGame(singleplayerEvent)).toBe(false);
    });

    it('should get max players correctly', () => {
      const twoPlayerEvent = createMockEvent([
        ['d', 'test-game'],
        ['mode', 'multiplayer'],
        ['players', '2']
      ]);

      const fourPlayerEvent = createMockEvent([
        ['d', 'test-game'],
        ['mode', 'multiplayer'],
        ['players', '4']
      ]);

      const singlePlayerEvent = createMockEvent([
        ['d', 'test-game'],
        ['mode', 'singleplayer']
      ]);

      expect(getMaxPlayers(twoPlayerEvent)).toBe(2);
      expect(getMaxPlayers(fourPlayerEvent)).toBe(4);
      expect(getMaxPlayers(singlePlayerEvent)).toBe(1);
    });
  });
});