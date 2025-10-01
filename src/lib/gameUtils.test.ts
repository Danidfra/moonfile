import { describe, it, expect } from 'vitest';
import { isMultiplayerGame, getGameModes, hasGameMode } from './gameUtils';
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

  describe('isMultiplayerGame', () => {
    it('should return true when event has ["mode", "multiplayer"] tag', () => {
      const event = createMockEvent([
        ['d', 'game-id'],
        ['name', 'Test Game'],
        ['mode', 'multiplayer']
      ]);

      expect(isMultiplayerGame(event)).toBe(true);
    });

    it('should return false when event does not have multiplayer mode tag', () => {
      const event = createMockEvent([
        ['d', 'game-id'],
        ['name', 'Test Game'],
        ['mode', 'singleplayer']
      ]);

      expect(isMultiplayerGame(event)).toBe(false);
    });

    it('should return false when event has no mode tags', () => {
      const event = createMockEvent([
        ['d', 'game-id'],
        ['name', 'Test Game']
      ]);

      expect(isMultiplayerGame(event)).toBe(false);
    });

    it('should return true when event has multiple mode tags including multiplayer', () => {
      const event = createMockEvent([
        ['d', 'game-id'],
        ['name', 'Test Game'],
        ['mode', 'singleplayer'],
        ['mode', 'multiplayer'],
        ['mode', 'co-op']
      ]);

      expect(isMultiplayerGame(event)).toBe(true);
    });

    it('should return false when mode tag has wrong format', () => {
      const event = createMockEvent([
        ['d', 'game-id'],
        ['name', 'Test Game'],
        ['mode'] // Missing value
      ]);

      expect(isMultiplayerGame(event)).toBe(false);
    });
  });

  describe('getGameModes', () => {
    it('should return all mode values from event tags', () => {
      const event = createMockEvent([
        ['d', 'game-id'],
        ['name', 'Test Game'],
        ['mode', 'singleplayer'],
        ['mode', 'multiplayer'],
        ['mode', 'co-op']
      ]);

      const modes = getGameModes(event);
      expect(modes).toEqual(['singleplayer', 'multiplayer', 'co-op']);
    });

    it('should return empty array when no mode tags exist', () => {
      const event = createMockEvent([
        ['d', 'game-id'],
        ['name', 'Test Game']
      ]);

      const modes = getGameModes(event);
      expect(modes).toEqual([]);
    });

    it('should filter out mode tags without values', () => {
      const event = createMockEvent([
        ['d', 'game-id'],
        ['name', 'Test Game'],
        ['mode', 'singleplayer'],
        ['mode'], // No value
        ['mode', 'multiplayer']
      ]);

      const modes = getGameModes(event);
      expect(modes).toEqual(['singleplayer', 'multiplayer']);
    });
  });

  describe('hasGameMode', () => {
    it('should return true when event has the specified mode', () => {
      const event = createMockEvent([
        ['d', 'game-id'],
        ['name', 'Test Game'],
        ['mode', 'singleplayer'],
        ['mode', 'multiplayer']
      ]);

      expect(hasGameMode(event, 'multiplayer')).toBe(true);
      expect(hasGameMode(event, 'singleplayer')).toBe(true);
    });

    it('should return false when event does not have the specified mode', () => {
      const event = createMockEvent([
        ['d', 'game-id'],
        ['name', 'Test Game'],
        ['mode', 'singleplayer']
      ]);

      expect(hasGameMode(event, 'multiplayer')).toBe(false);
      expect(hasGameMode(event, 'co-op')).toBe(false);
    });

    it('should return false when no mode tags exist', () => {
      const event = createMockEvent([
        ['d', 'game-id'],
        ['name', 'Test Game']
      ]);

      expect(hasGameMode(event, 'multiplayer')).toBe(false);
    });

    it('should be case-sensitive', () => {
      const event = createMockEvent([
        ['d', 'game-id'],
        ['name', 'Test Game'],
        ['mode', 'multiplayer']
      ]);

      expect(hasGameMode(event, 'multiplayer')).toBe(true);
      expect(hasGameMode(event, 'Multiplayer')).toBe(false);
      expect(hasGameMode(event, 'MULTIPLAYER')).toBe(false);
    });
  });
});