import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMultiplayerRoom } from './useMultiplayerRoom';
import { TestApp } from '@/test/TestApp';
import type { NostrEvent } from '@nostrify/nostrify';

// Mock the dependencies
const mockQuery = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockQuery,
      req: vi.fn()
    }
  })
}));

vi.mock('./useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: {
      pubkey: 'host-pubkey-123'
    }
  })
}));

vi.mock('./useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: mockMutateAsync
  })
}));

describe('useMultiplayerRoom - Host Guest Listening Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock window.location.origin
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'https://test.example.com'
      },
      writable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should host room and listen for guests with correct filters', async () => {
    // Mock no existing room (so user becomes host)
    mockQuery.mockResolvedValue([]);

    // Mock successful host event publishing
    const mockHostEvent: NostrEvent = {
      id: 'host-event-id',
      pubkey: 'host-pubkey-123',
      created_at: Date.now(),
      kind: 31997,
      tags: [],
      content: '',
      sig: 'mock-signature'
    };
    mockMutateAsync.mockResolvedValue(mockHostEvent);

    const { result } = renderHook(
      () => useMultiplayerRoom('test-room-id', 'test-game-id'),
      {
        wrapper: ({ children }) => <TestApp>{children}</TestApp>
      }
    );

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify host event was published with correct structure
    expect(mockMutateAsync).toHaveBeenCalled();
    const hostPublishCall = mockMutateAsync.mock.calls[0][0];
    expect(hostPublishCall.kind).toBe(31997);
    expect(hostPublishCall.tags).toContainEqual(['d', 'test-room-id']);
    expect(hostPublishCall.tags).toContainEqual(['game', 'test-game-id']);
    expect(hostPublishCall.tags).toContainEqual(['host', 'host-pubkey-123']);
    expect(hostPublishCall.tags).toContainEqual(['status', 'waiting']);
    expect(hostPublishCall.tags).toContainEqual(['players', '2']);

    // Verify room state
    expect(result.current.isHost).toBe(true);
    expect(result.current.roomState.status).toBe('waiting_for_player');
    expect(result.current.roomState.hostPubkey).toBe('host-pubkey-123');
  });

  it('should detect valid guest events with correct filters', async () => {
    // Mock no existing room (so user becomes host)
    mockQuery.mockResolvedValue([]);

    // Mock successful host event publishing
    const mockHostEvent: NostrEvent = {
      id: 'host-event-id',
      pubkey: 'host-pubkey-123',
      created_at: Date.now(),
      kind: 31997,
      tags: [],
      content: '',
      sig: 'mock-signature'
    };
    mockMutateAsync.mockResolvedValue(mockHostEvent);

    const { result } = renderHook(
      () => useMultiplayerRoom('test-room-id', 'test-game-id'),
      {
        wrapper: ({ children }) => <TestApp>{children}</TestApp>
      }
    );

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Mock guest event with correct filters
    const mockGuestEvent: NostrEvent = {
      id: 'guest-event-id',
      pubkey: 'guest-pubkey-456',
      created_at: Date.now() + 1000,
      kind: 31997,
      tags: [
        ['d', 'test-room-id'],
        ['game', 'test-game-id'],
        ['host', 'host-pubkey-123'],
        ['guest', 'guest-pubkey-456'],
        ['status', 'active']
      ],
      content: '',
      sig: 'mock-signature'
    };

    // Mock query to return the guest event
    mockQuery.mockResolvedValue([mockGuestEvent]);

    // Trigger a poll
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Verify guest was detected and added
    expect(result.current.roomState.connectedPlayers).toHaveLength(2);
    expect(result.current.roomState.connectedPlayers[1].pubkey).toBe('guest-pubkey-456');
    expect(result.current.roomState.status).toBe('active');
  });

  it('should ignore guest events with wrong filters', async () => {
    // Mock no existing room (so user becomes host)
    mockQuery.mockResolvedValue([]);

    // Mock successful host event publishing
    const mockHostEvent: NostrEvent = {
      id: 'host-event-id',
      pubkey: 'host-pubkey-123',
      created_at: Date.now(),
      kind: 31997,
      tags: [],
      content: '',
      sig: 'mock-signature'
    };
    mockMutateAsync.mockResolvedValue(mockHostEvent);

    const { result } = renderHook(
      () => useMultiplayerRoom('test-room-id', 'test-game-id'),
      {
        wrapper: ({ children }) => <TestApp>{children}</TestApp>
      }
    );

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Mock guest event with wrong game ID (should be ignored)
    const mockInvalidGuestEvent: NostrEvent = {
      id: 'guest-event-id',
      pubkey: 'guest-pubkey-456',
      created_at: Date.now() + 1000,
      kind: 31997,
      tags: [
        ['d', 'test-room-id'],
        ['game', 'wrong-game-id'], // Wrong game ID
        ['host', 'host-pubkey-123'],
        ['guest', 'guest-pubkey-456'],
        ['status', 'active']
      ],
      content: '',
      sig: 'mock-signature'
    };

    // Mock query to return the invalid guest event
    mockQuery.mockResolvedValue([mockInvalidGuestEvent]);

    // Trigger a poll
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Verify guest was NOT detected (still only host)
    expect(result.current.roomState.connectedPlayers).toHaveLength(1);
    expect(result.current.roomState.connectedPlayers[0].pubkey).toBe('host-pubkey-123');
  });

  it('should stop listening when room is full', async () => {
    // Mock no existing room (so user becomes host)
    mockQuery.mockResolvedValue([]);

    // Mock successful host event publishing
    const mockHostEvent: NostrEvent = {
      id: 'host-event-id',
      pubkey: 'host-pubkey-123',
      created_at: Date.now(),
      kind: 31997,
      tags: [],
      content: '',
      sig: 'mock-signature'
    };
    mockMutateAsync.mockResolvedValue(mockHostEvent);

    const { result } = renderHook(
      () => useMultiplayerRoom('test-room-id', 'test-game-id'),
      {
        wrapper: ({ children }) => <TestApp>{children}</TestApp>
      }
    );

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Mock guest event (this should fill the room for 2-player game)
    const mockGuestEvent: NostrEvent = {
      id: 'guest-event-id',
      pubkey: 'guest-pubkey-456',
      created_at: Date.now() + 1000,
      kind: 31997,
      tags: [
        ['d', 'test-room-id'],
        ['game', 'test-game-id'],
        ['host', 'host-pubkey-123'],
        ['guest', 'guest-pubkey-456'],
        ['status', 'active']
      ],
      content: '',
      sig: 'mock-signature'
    };

    // Mock room update event
    const mockUpdatedHostEvent: NostrEvent = {
      id: 'updated-host-event-id',
      pubkey: 'host-pubkey-123',
      created_at: Date.now() + 2000,
      kind: 31997,
      tags: [],
      content: '',
      sig: 'mock-signature'
    };

    // Mock query to return the guest event, then the updated host event
    mockQuery.mockResolvedValueOnce([mockGuestEvent]);
    mockMutateAsync.mockResolvedValueOnce(mockUpdatedHostEvent);

    // Trigger a poll that should detect guest and fill room
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Verify room is full and status is updated
    expect(result.current.roomState.status).toBe('room_full');
    expect(result.current.roomState.connectedPlayers).toHaveLength(2);

    // Verify the host published an updated event with connected guests
    expect(mockMutateAsync).toHaveBeenCalledTimes(2); // Initial + update
    const updateCall = mockMutateAsync.mock.calls[1][0];
    expect(updateCall.tags).toContainEqual(['status', 'full']);
    expect(updateCall.tags).toContainEqual(['connected', 'guest-pubkey-456']);

    // Mock another guest event (should be ignored since room is full)
    const mockSecondGuestEvent: NostrEvent = {
      id: 'second-guest-event-id',
      pubkey: 'second-guest-pubkey-789',
      created_at: Date.now() + 3000,
      kind: 31997,
      tags: [
        ['d', 'test-room-id'],
        ['game', 'test-game-id'],
        ['host', 'host-pubkey-123'],
        ['guest', 'second-guest-pubkey-789'],
        ['status', 'active']
      ],
      content: '',
      sig: 'mock-signature'
    };

    // Mock query to return the second guest event
    mockQuery.mockResolvedValue([mockSecondGuestEvent]);

    // Trigger another poll
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Verify second guest was NOT added (room still has 2 players)
    expect(result.current.roomState.connectedPlayers).toHaveLength(2);
    expect(result.current.roomState.connectedPlayers.some(p => p.pubkey === 'second-guest-pubkey-789')).toBe(false);
  });

  it('should process guest events in chronological order', async () => {
    // Mock no existing room (so user becomes host)
    mockQuery.mockResolvedValue([]);

    // Mock successful host event publishing
    const mockHostEvent: NostrEvent = {
      id: 'host-event-id',
      pubkey: 'host-pubkey-123',
      created_at: Date.now(),
      kind: 31997,
      tags: [],
      content: '',
      sig: 'mock-signature'
    };
    mockMutateAsync.mockResolvedValue(mockHostEvent);

    // Set up for 3-player game
    const { result } = renderHook(
      () => useMultiplayerRoom('test-room-id', 'test-game-id'),
      {
        wrapper: ({ children }) => <TestApp>{children}</TestApp>
      }
    );

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Create two guest events with different timestamps
    const firstGuestEvent: NostrEvent = {
      id: 'first-guest-event-id',
      pubkey: 'first-guest-pubkey-456',
      created_at: Date.now() + 1000,
      kind: 31997,
      tags: [
        ['d', 'test-room-id'],
        ['game', 'test-game-id'],
        ['host', 'host-pubkey-123'],
        ['guest', 'first-guest-pubkey-456'],
        ['status', 'active']
      ],
      content: '',
      sig: 'mock-signature'
    };

    const secondGuestEvent: NostrEvent = {
      id: 'second-guest-event-id',
      pubkey: 'second-guest-pubkey-789',
      created_at: Date.now() + 2000,
      kind: 31997,
      tags: [
        ['d', 'test-room-id'],
        ['game', 'test-game-id'],
        ['host', 'host-pubkey-123'],
        ['guest', 'second-guest-pubkey-789'],
        ['status', 'active']
      ],
      content: '',
      sig: 'mock-signature'
    };

    // Mock query to return both guests (second should come first in query results due to sorting)
    mockQuery.mockResolvedValue([secondGuestEvent, firstGuestEvent]);

    // Trigger a poll
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Verify guests were processed in chronological order (first guest should be first)
    expect(result.current.roomState.connectedPlayers).toHaveLength(3); // Host + 2 guests
    expect(result.current.roomState.connectedPlayers[1].pubkey).toBe('first-guest-pubkey-456');
    expect(result.current.roomState.connectedPlayers[2].pubkey).toBe('second-guest-pubkey-789');
  });
});