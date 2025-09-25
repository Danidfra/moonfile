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
      pubkey: 'guest-pubkey-123'
    }
  })
}));

vi.mock('./useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: mockMutateAsync
  })
}));

describe('useMultiplayerRoom - Guest Event Generation', () => {
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

  it('should generate guest event with correct tags when joining room', async () => {
    // Mock host event response
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

    // Mock successful event publishing
    const mockGuestEvent: NostrEvent = {
      id: 'guest-event-id',
      pubkey: 'guest-pubkey-123',
      created_at: Date.now(),
      kind: 31997,
      tags: [],
      content: '',
      sig: 'mock-signature'
    };

    mockQuery.mockResolvedValue([mockHostEvent]);
    mockMutateAsync.mockResolvedValue(mockGuestEvent);

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

    // Verify that publishEvent was called with correct guest event structure
    expect(mockMutateAsync).toHaveBeenCalled();
    const publishCall = mockMutateAsync.mock.calls[0][0];

    // Verify the event structure
    expect(publishCall.kind).toBe(31997);
    expect(publishCall.content).toBe('');

    // Verify the tags structure
    const expectedTags = [
      ['d', 'test-room-id'],
      ['game', 'test-game-id'],
      ['host', 'host-pubkey-456'],
      ['guest', 'guest-pubkey-123'],
      ['status', 'active']
    ];

    expect(publishCall.tags).toEqual(expectedTags);

    // Verify that old tags are not present
    const tagNames = publishCall.tags.map(tag => tag[0]);
    expect(tagNames).not.toContain('player');
    expect(tagNames).not.toContain('connected');

    // Verify that new tags are present
    expect(tagNames).toContain('host');
    expect(tagNames).toContain('guest');
  });

  it('should detect guest events using new tag structure', async () => {
    // Mock guest event with new structure
    const mockGuestEvent: NostrEvent = {
      id: 'guest-event-id',
      pubkey: 'guest-pubkey-789',
      created_at: Date.now(),
      kind: 31997,
      tags: [
        ['d', 'test-room-id'],
        ['game', 'test-game-id'],
        ['host', 'host-pubkey-456'],
        ['guest', 'guest-pubkey-789'],
        ['status', 'active']
      ],
      content: '',
      sig: 'mock-signature'
    };

    // Mock initial query to return no events (so user becomes host)
    mockQuery.mockResolvedValue([]);

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

    // Now mock the query to return the guest event
    mockQuery.mockResolvedValue([mockGuestEvent]);

    // Trigger a poll (this simulates the periodic polling)
    await act(async () => {
      // Simulate the pollForGuestEvents function being called
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // The guest should be detected and added to connected players
    expect(result.current.roomState.connectedPlayers).toHaveLength(1);
    expect(result.current.roomState.connectedPlayers[0].pubkey).toBe('guest-pubkey-789');
  });

  it('should not detect events without proper guest structure', async () => {
    // Mock event with old structure (should not be detected)
    const mockOldEvent: NostrEvent = {
      id: 'old-event-id',
      pubkey: 'guest-pubkey-789',
      created_at: Date.now(),
      kind: 31997,
      tags: [
        ['d', 'test-room-id'],
        ['game', 'test-game-id'],
        ['player', 'guest-pubkey-789'],
        ['status', 'active'],
        ['connected', 'guest-pubkey-789']
      ],
      content: '',
      sig: 'mock-signature'
    };

    // Mock initial query to return no events (so user becomes host)
    mockQuery.mockResolvedValue([]);

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

    // Now mock the query to return the old event
    mockQuery.mockResolvedValue([mockOldEvent]);

    // Trigger a poll
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // The guest should not be detected because it doesn't have the new structure
    expect(result.current.roomState.connectedPlayers).toHaveLength(1); // Only host
    expect(result.current.roomState.connectedPlayers[0].pubkey).not.toBe('guest-pubkey-789');
  });

  it('should check for existing guest connection using new tag structure', async () => {
    // Mock host event with existing guest
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
        ['players', '2'],
        ['guest', 'guest-pubkey-123'] // Current user already connected
      ],
      content: '',
      sig: 'mock-signature'
    };

    mockQuery.mockResolvedValue([mockHostEvent]);

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

    // The room state should show an error because user is already connected
    expect(result.current.roomState.status).toBe('error');
    expect(result.current.roomState.error).toBe('You are already connected to this room');
  });
});