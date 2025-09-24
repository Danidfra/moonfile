import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMultiplayerRoom } from './useMultiplayerRoom';
import { TestApp } from '@/test/TestApp';

// Mock the dependencies
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: vi.fn(),
      req: vi.fn()
    }
  })
}));

vi.mock('./useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: {
      pubkey: 'test-pubkey-123'
    }
  })
}));

vi.mock('./useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: vi.fn()
  })
}));

describe('useMultiplayerRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with waiting state', () => {
    const { result } = renderHook(
      () => useMultiplayerRoom('test-room-id', 'test-game-id'),
      {
        wrapper: ({ children }) => <TestApp>{children}</TestApp>
      }
    );

    expect(result.current.roomState.status).toBe('waiting');
    expect(result.current.roomState.connectedPlayers).toEqual([]);
    expect(result.current.roomState.requiredPlayers).toBe(2);
    expect(result.current.roomState.latestEvent).toBeNull();
  });

  it('should identify host correctly', () => {
    const { result } = renderHook(
      () => useMultiplayerRoom('test-room-id', 'test-game-id'),
      {
        wrapper: ({ children }) => <TestApp>{children}</TestApp>
      }
    );

    expect(result.current.isHost).toBe(false);
  });

  it('should have startGame function available', () => {
    const { result } = renderHook(
      () => useMultiplayerRoom('test-room-id', 'test-game-id'),
      {
        wrapper: ({ children }) => <TestApp>{children}</TestApp>
      }
    );

    expect(typeof result.current.startGame).toBe('function');
  });

  it('should have sendGameInput and sendGameState functions', () => {
    const { result } = renderHook(
      () => useMultiplayerRoom('test-room-id', 'test-game-id'),
      {
        wrapper: ({ children }) => <TestApp>{children}</TestApp>
      }
    );

    expect(typeof result.current.sendGameInput).toBe('function');
    expect(typeof result.current.sendGameState).toBe('function');
  });

  it('should initialize with null WebRTC connection and signal', () => {
    const { result } = renderHook(
      () => useMultiplayerRoom('test-room-id', 'test-game-id'),
      {
        wrapper: ({ children }) => <TestApp>{children}</TestApp>
      }
    );

    expect(result.current.webRTCConnection).toBeNull();
    expect(result.current.localSignal).toBeNull();
  });
});