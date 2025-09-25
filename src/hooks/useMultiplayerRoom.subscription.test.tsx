import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMultiplayerRoom } from './useMultiplayerRoom';
import { TestApp } from '@/test/TestApp';
import type { NostrEvent } from '@nostrify/nostrify';

// Mock the dependencies
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

describe('useMultiplayerRoom - Subscription and Relay Logic', () => {
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

  it('should publish host event only to connected relays', async () => {
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
    mockEvent.mockResolvedValue(mockHostEvent);

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

    // Verify relay group was created with connected relays only
    expect(mockGroup).toHaveBeenCalledWith(['wss://relay.example.com']);
    
    // Verify event was published through relay group, not directly
    expect(mockEvent).toHaveBeenCalled();
    expect(mockMutateAsync).not.toHaveBeenCalled(); // Should not use global publish
  });

  it('should create single REQ subscription for host, not repeated polling', async () => {
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
    mockEvent.mockResolvedValue(mockHostEvent);

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

    // Verify relay group was created with connected relays only
    expect(mockGroup).toHaveBeenCalledWith(['wss://relay.example.com']);
    
    // Verify single REQ subscription was created (not polling)
    expect(mockReq).toHaveBeenCalledTimes(1);
    
    // Verify correct filters were used
    const reqCall = mockReq.mock.calls[0];
    const filter = reqCall[0][0];
    expect(filter.kinds).toEqual([31997]);
    expect(filter['#d']).toEqual(['test-room-id']);
    expect(filter['#game']).toEqual(['test-game-id']);
    expect(filter['#host']).toEqual(['host-pubkey-123']);
    expect(filter.limit).toBe(20);

    // Verify subscription callbacks were provided
    expect(typeof reqCall[1].onevent).toBe('function');
    expect(typeof reqCall[1].onclose).toBe('function');
    expect(typeof reqCall[1].onerror).toBe('function');
  });

  it('should publish guest events only to connected relays', async () => {
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
      pubkey: 'guest-pubkey-123',
      created_at: Date.now(),
      kind: 31997,
      tags: [],
      content: '',
      sig: 'mock-signature'
    };
    mockEvent.mockResolvedValue(mockGuestEvent);

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

    // Verify relay group was created with connected relays only for guest event publishing
    expect(mockGroup).toHaveBeenCalledWith(['wss://relay.example.com']);
    
    // Verify guest event was published through relay group
    expect(mockEvent).toHaveBeenCalled();
    
    // Verify guest event has correct structure
    const eventCall = mockEvent.mock.calls[0][0];
    expect(eventCall.kind).toBe(31997);
    expect(eventCall.tags).toContainEqual(['d', 'test-room-id']);
    expect(eventCall.tags).toContainEqual(['game', 'test-game-id']);
    expect(eventCall.tags).toContainEqual(['host', 'host-pubkey-456']);
    expect(eventCall.tags).toContainEqual(['guest', 'host-pubkey-123']); // Note: in test, user is host, but in guest flow this would be guest
    expect(eventCall.tags).toContainEqual(['status', 'active']);
  });

  it('should close subscription with CLOSE message when room is full', async () => {
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
    mockEvent.mockResolvedValue(mockHostEvent);

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
    mockEvent.mockResolvedValue(mockUpdatedHostEvent);

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

    // Trigger the subscription callback with guest event
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
    expect(mockEvent).toHaveBeenCalledTimes(2); // Initial + update
    const updateCall = mockEvent.mock.calls[1][0];
    expect(updateCall.tags).toContainEqual(['status', 'full']);
    expect(updateCall.tags).toContainEqual(['connected', 'guest-pubkey-456']);
  });

  it('should not create repeated REQ messages (no polling)', async () => {
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
    mockEvent.mockResolvedValue(mockHostEvent);

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

    // Verify only one REQ was created
    expect(mockReq).toHaveBeenCalledTimes(1);

    // Wait some time to verify no additional REQs are created (no polling)
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
    });

    // Still should only have one REQ (no polling)
    expect(mockReq).toHaveBeenCalledTimes(1);
  });

  it('should cleanup subscriptions properly on unmount', async () => {
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
    mockEvent.mockResolvedValue(mockHostEvent);

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

    // Unmount the hook
    unmount();

    // Verify subscription was closed
    expect(mockSubscriptionClose).toHaveBeenCalled();
  });
});