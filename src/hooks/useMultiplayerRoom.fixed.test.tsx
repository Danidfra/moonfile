import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMultiplayerRoom } from './useMultiplayerRoom';
import { TestApp } from '@/test/TestApp';
import type { NostrEvent } from '@nostrify/nostrify';

// Mock dependencies
const mockQuery = vi.fn();
const mockReq = vi.fn();
const mockEvent = vi.fn();
const mockGroup = vi.fn();
const mockMutateAsync = vi.fn();

const mockRelayGroup = {
  query: mockQuery,
  req: mockReq,
  event: mockEvent
};

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockQuery,
      req: mockReq,
      event: mockEvent,
      group: mockGroup.mockReturnValue(mockRelayGroup)
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

vi.mock('./useAppContext', () => ({
  useAppContext: () => ({
    config: {
      relayUrl: 'wss://relay.example.com'
    }
  })
}));

describe('useMultiplayerRoom - Fixed Implementation', () => {
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

  it('should use config.relayUrl for all operations', async () => {
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

    // Mock subscription creation
    const mockSubscriptionClose = vi.fn();
    const mockSubscription = {
      close: mockSubscriptionClose
    };
    mockReq.mockReturnValue(mockSubscription);

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

    // Verify config.relayUrl is used consistently
    expect(mockGroup).toHaveBeenCalledWith(['wss://relay.example.com']);
    expect(mockGroup).toHaveBeenCalledTimes(3); // checkIfHost, fetchHostRoomEvent, subscription
    
    // Verify publishEvent is called with relays prop
    expect(mockMutateAsync).toHaveBeenCalledWith({
      kind: 31997,
      content: '',
      tags: [
        ['d', 'test-room-id'],
        ['game', 'test-game-id'],
        ['host', 'host-pubkey-123'],
        ['status', 'waiting'],
        ['players', '2']
      ],
      relays: ['wss://relay.example.com']
    });
  });

  it('should use proper Nostr subscriptions instead of polling', async () => {
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

    // Mock subscription creation
    const mockSubscriptionClose = vi.fn();
    const mockSubscription = {
      close: mockSubscriptionClose
    };
    mockReq.mockReturnValue(mockSubscription);

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

    // Verify req() was called (subscription) instead of repeated query() calls
    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockQuery).not.toHaveBeenCalled(); // No polling queries

    // Verify subscription has proper filter
    const reqCall = mockReq.mock.calls[0];
    const filter = reqCall[0][0];
    expect(filter).toEqual({
      kinds: [31997],
      '#d': ['test-room-id'],
      '#game': ['test-game-id'],
      '#host': ['host-pubkey-123'],
      limit: 20
    });

    // Verify subscription callbacks are provided
    expect(reqCall[1]).toHaveProperty('onevent');
    expect(reqCall[1]).toHaveProperty('onclose');
    expect(reqCall[1]).toHaveProperty('onerror');
  });

  it('should handle guest subscription correctly', async () => {
    // Mock existing host room (so user becomes guest)
    const mockHostEvent: NostrEvent = {
      id: 'host-event-id',
      pubkey: 'host-pubkey-456',
      created_at: Date.now(),
      kind: 31997,
      tags: [
        ['d', 'test-room-id'],
        ['game', 'test-game-id'],
        ['host', 'host-pubkey-456'],
        ['status', 'waiting_for_player'],
        ['players', '2']
      ],
      content: '',
      sig: 'mock-signature'
    };
    mockQuery.mockResolvedValue([mockHostEvent]);

    // Mock successful guest event publishing
    const mockGuestEvent: NostrEvent = {
      id: 'guest-event-id',
      pubkey: 'host-pubkey-123', // In test, user is still host but should act as guest
      created_at: Date.now(),
      kind: 31997,
      tags: [],
      content: '',
      sig: 'mock-signature'
    };
    mockMutateAsync.mockResolvedValue(mockGuestEvent);

    // Mock subscription creation for guest
    const mockSubscriptionClose = vi.fn();
    const mockSubscription = {
      close: mockSubscriptionClose
    };
    mockReq.mockReturnValue(mockSubscription);

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

    // Verify guest also uses config.relayUrl
    expect(mockGroup).toHaveBeenCalledWith(['wss://relay.example.com']);

    // Verify guest subscription was created with correct filter
    expect(mockReq).toHaveBeenCalledTimes(1);
    const reqCall = mockReq.mock.calls[0];
    const filter = reqCall[0][0];
    expect(filter).toEqual({
      kinds: [31997],
      '#d': ['test-room-id'],
      limit: 10
    });

    // Verify guest event was published with relays prop
    expect(mockMutateAsync).toHaveBeenCalledWith({
      kind: 31997,
      content: '',
      tags: [
        ['d', 'test-room-id'],
        ['game', 'test-game-id'],
        ['host', 'host-pubkey-456'],
        ['guest', 'host-pubkey-123'],
        ['status', 'active']
      ],
      relays: ['wss://relay.example.com']
    });
  });

  it('should properly close subscriptions when room is full', async () => {
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

    // Mock subscription creation
    const mockSubscriptionClose = vi.fn();
    const mockSubscription = {
      close: mockSubscriptionClose
    };
    mockReq.mockReturnValue(mockSubscription);

    // Mock room update event
    const mockUpdatedHostEvent: NostrEvent = {
      id: 'updated-host-event-id',
      pubkey: 'host-pubkey-123',
      created_at: Date.now(),
      kind: 31997,
      tags: [],
      content: '',
      sig: 'mock-signature'
    };
    mockMutateAsync.mockResolvedValue(mockUpdatedHostEvent);

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

    // Simulate guest event that fills the room
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

    // Trigger subscription callback with guest event
    const reqCall = mockReq.mock.calls[0];
    act(() => {
      reqCall[1].onevent(mockGuestEvent);
    });

    // Wait for async operations
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify subscription was closed when room became full
    expect(mockSubscriptionClose).toHaveBeenCalled();
    
    // Verify room was updated with connected guests
    expect(mockMutateAsync).toHaveBeenCalledTimes(2); // Initial + update
    const updateCall = mockMutateAsync.mock.calls[1][0];
    expect(updateCall.tags).toContainEqual(['status', 'full']);
    expect(updateCall.tags).toContainEqual(['connected', 'guest-pubkey-456']);
    expect(updateCall.relays).toEqual(['wss://relay.example.com']);
  });

  it('should properly cleanup on unmount', async () => {
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

    // Mock subscription creation
    const mockSubscriptionClose = vi.fn();
    const mockSubscription = {
      close: mockSubscriptionClose
    };
    mockReq.mockReturnValue(mockSubscription);

    const { result, unmount } = renderHook(
      () => useMultiplayerRoom('test-room-id', 'test-game-id'),
      {
        wrapper: ({ children }) => <TestApp>{children}</TestApp>
      }
    );

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify subscription was created
    expect(mockReq).toHaveBeenCalledTimes(1);

    // Unmount hook
    unmount();

    // Verify subscription was closed
    expect(mockSubscriptionClose).toHaveBeenCalled();
  });

  it('should have all required refs properly initialized', async () => {
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

    // Mock subscription creation
    const mockSubscriptionClose = vi.fn();
    const mockSubscription = {
      close: mockSubscriptionClose
    };
    mockReq.mockReturnValue(mockSubscription);

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

    // Verify room state
    expect(result.current.roomState.status).toBe('waiting_for_player');
    expect(result.current.roomState.hostPubkey).toBe('host-pubkey-123');
    expect(result.current.roomState.connectedPlayers).toHaveLength(1);
    expect(result.current.roomState.connectedPlayers[0].pubkey).toBe('host-pubkey-123');
    expect(result.current.isHost).toBe(true);
  });
});