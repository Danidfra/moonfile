import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNostrPublish } from './useNostrPublish';
import { TestApp } from '@/test/TestApp';
import type { NostrEvent } from '@jsr/nostrify__nostrify';

// Mock dependencies
const mockEvent = vi.fn();
const mockGroup = vi.fn();
const mockSignEvent = vi.fn();

const mockRelayGroup = {
  event: mockEvent
};

vi.mock('@jsr/nostrify__react', () => ({
  useNostr: () => ({
    nostr: {
      event: mockEvent,
      group: mockGroup.mockReturnValue(mockRelayGroup)
    }
  })
}));

vi.mock('./useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: {
      pubkey: 'test-pubkey',
      signer: {
        signEvent: mockSignEvent
      }
    }
  })
}));

describe('useNostrPublish - Relays Support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock window.location.protocol for client tag
    Object.defineProperty(window, 'location', {
      value: {
        protocol: 'https:',
        hostname: 'test.example.com'
      },
      writable: true
    });

    // Mock successful event signing
    const signedEvent: NostrEvent = {
      id: 'test-event-id',
      pubkey: 'test-pubkey',
      created_at: Date.now(),
      kind: 1,
      tags: [],
      content: 'test content',
      sig: 'test-signature'
    };
    mockSignEvent.mockResolvedValue(signedEvent);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should publish to default relays when no relays prop is provided', async () => {
    const { result } = renderHook(
      () => useNostrPublish(),
      {
        wrapper: ({ children }) => <TestApp>{children}</TestApp>
      }
    );

    const eventParams = {
      kind: 1,
      content: 'test content',
      tags: []
    };

    await act(async () => {
      await result.current.mutateAsync(eventParams);
    });

    // Should use default nostr.event (all connected relays)
    expect(mockEvent).toHaveBeenCalledWith(signedEvent, { signal: AbortSignal.timeout(5000) });
    expect(mockGroup).not.toHaveBeenCalled(); // Should not create relay group
  });

  it('should publish to specified relays when relays prop is provided', async () => {
    const { result } = renderHook(
      () => useNostrPublish(),
      {
        wrapper: ({ children }) => <TestApp>{children}</TestApp>
      }
    );

    const eventParams = {
      kind: 1,
      content: 'test content',
      tags: [],
      relays: ['wss://relay1.example.com', 'wss://relay2.example.com']
    };

    await act(async () => {
      await result.current.mutateAsync(eventParams);
    });

    // Should create relay group with specified relays
    expect(mockGroup).toHaveBeenCalledWith(['wss://relay1.example.com', 'wss://relay2.example.com']);
    
    // Should publish through relay group
    expect(mockRelayGroup.event).toHaveBeenCalledWith(signedEvent, { signal: AbortSignal.timeout(5000) });
    
    // Should not use default nostr.event
    expect(mockEvent).not.toHaveBeenCalled();
  });

  it('should publish to single relay when relays prop has one URL', async () => {
    const { result } = renderHook(
      () => useNostrPublish(),
      {
        wrapper: ({ children }) => <TestApp>{children}</TestApp>
      }
    );

    const eventParams = {
      kind: 1,
      content: 'test content',
      tags: [],
      relays: ['wss://single-relay.example.com']
    };

    await act(async () => {
      await result.current.mutateAsync(eventParams);
    });

    // Should create relay group with single relay
    expect(mockGroup).toHaveBeenCalledWith(['wss://single-relay.example.com']);
    
    // Should publish through relay group
    expect(mockRelayGroup.event).toHaveBeenCalledWith(signedEvent, { signal: AbortSignal.timeout(5000) });
    
    // Should not use default nostr.event
    expect(mockEvent).not.toHaveBeenCalled();
  });

  it('should not create relay group when relays prop is empty array', async () => {
    const { result } = renderHook(
      () => useNostrPublish(),
      {
        wrapper: ({ children }) => <TestApp>{children}</TestApp>
      }
    );

    const eventParams = {
      kind: 1,
      content: 'test content',
      tags: [],
      relays: []
    };

    await act(async () => {
      await result.current.mutateAsync(eventParams);
    });

    // Should use default nostr.event when relays array is empty
    expect(mockEvent).toHaveBeenCalledWith(signedEvent, { signal: AbortSignal.timeout(5000) });
    expect(mockGroup).not.toHaveBeenCalled(); // Should not create relay group
  });

  it('should handle event signing failure gracefully', async () => {
    mockSignEvent.mockRejectedValue(new Error('Signing failed'));

    const { result } = renderHook(
      () => useNostrPublish(),
      {
        wrapper: ({ children }) => <TestApp>{children}</TestApp>
      }
    );

    const eventParams = {
      kind: 1,
      content: 'test content',
      tags: [],
      relays: ['wss://relay.example.com']
    };

    await expect(async () => {
      await act(async () => {
        await result.current.mutateAsync(eventParams);
      });
    }).rejects.toThrow('Signing failed');

    // Should not attempt to publish if signing fails
    expect(mockGroup).not.toHaveBeenCalled();
    expect(mockRelayGroup.event).not.toHaveBeenCalled();
    expect(mockEvent).not.toHaveBeenCalled();
  });

  it('should add client tag automatically for HTTPS', async () => {
    const { result } = renderHook(
      () => useNostrPublish(),
      {
        wrapper: ({ children }) => <TestApp>{children}</TestApp>
      }
    );

    const eventParams = {
      kind: 1,
      content: 'test content',
      tags: [],
      relays: ['wss://relay.example.com']
    };

    await act(async () => {
      await result.current.mutateAsync(eventParams);
    });

    // Should sign event with client tag added
    expect(mockSignEvent).toHaveBeenCalledWith({
      kind: 1,
      content: 'test content',
      tags: [['client', 'test.example.com']],
      created_at: expect.any(Number)
    });
  });

  it('should not add client tag if already present', async () => {
    const { result } = renderHook(
      () => useNostrPublish(),
      {
        wrapper: ({ children }) => <TestApp>{children}</TestApp>
      }
    );

    const eventParams = {
      kind: 1,
      content: 'test content',
      tags: [['client', 'custom-client']],
      relays: ['wss://relay.example.com']
    };

    await act(async () => {
      await result.current.mutateAsync(eventParams);
    });

    // Should sign event without adding duplicate client tag
    expect(mockSignEvent).toHaveBeenCalledWith({
      kind: 1,
      content: 'test content',
      tags: [['client', 'custom-client']],
      created_at: expect.any(Number)
    });
  });

  it('should not add client tag for non-HTTPS', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        protocol: 'http:',
        hostname: 'test.example.com'
      },
      writable: true
    });

    const { result } = renderHook(
      () => useNostrPublish(),
      {
        wrapper: ({ children }) => <TestApp>{children}</TestApp>
      }
    );

    const eventParams = {
      kind: 1,
      content: 'test content',
      tags: [],
      relays: ['wss://relay.example.com']
    };

    await act(async () => {
      await result.current.mutateAsync(eventParams);
    });

    // Should sign event without client tag for HTTP
    expect(mockSignEvent).toHaveBeenCalledWith({
      kind: 1,
      content: 'test content',
      tags: [],
      created_at: expect.any(Number)
    });
  });
});