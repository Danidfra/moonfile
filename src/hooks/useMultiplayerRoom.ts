import { useState, useEffect, useRef, useCallback } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import type { NostrEvent } from '@nostrify/nostrify';

interface ConnectedPlayer {
  pubkey: string;
  signal?: string;
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: number;
  senderName?: string;
}

interface RoomState {
  status: 'waiting' | 'active' | 'full' | 'error' | 'playing' | 'waiting_for_player' | 'waiting_to_retry';
  hostPubkey: string;
  requiredPlayers: number;
  connectedPlayers: ConnectedPlayer[];
  error?: string;
  shareableLink?: string;
  chatMessages?: ChatMessage[];
  canJoinGame?: boolean;
  isWebRTCConnected?: boolean;
}

export function useMultiplayerRoom(roomId: string, gameId: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();

  // Internal state
  const [roomState, setRoomState] = useState<RoomState>({
    status: 'waiting',
    hostPubkey: '',
    requiredPlayers: 2,
    connectedPlayers: [],
    chatMessages: [],
    canJoinGame: false,
    isWebRTCConnected: false,
  });

  const [isHost, setIsHost] = useState(false);
  const [currentRoomEventId, setCurrentRoomEventId] = useState<string | null>(null);

  // Refs for cleanup and state tracking
  const subscriptionRef = useRef<{ close: () => void } | null>(null);
  const hostTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const roomInitializedRef = useRef(false);

  // Generate shareable link
  const generateShareableLink = useCallback((roomId: string): string => {
    return `${window.location.origin}/multiplayer/${gameId}/${roomId}`;
  }, [gameId]);

  // Check if current user should be host
  const checkIfHost = useCallback(async (): Promise<boolean> => {
    if (!nostr || !user || !roomId) return false;

    try {
      // Check if room already exists
      const existingEvents = await nostr.query([{
        kinds: [31997],
        '#d': [roomId],
        limit: 1
      }], { signal: AbortSignal.timeout(5000) });

      if (existingEvents.length > 0) {
        const roomEvent = existingEvents[0];
        const hostTag = roomEvent.tags.find(t => t[0] === 'host')?.[1];

        // If current user is the host of existing room
        if (hostTag === user.pubkey) {
          console.log('[MultiplayerRoom] Current user is host of existing room');
          return true;
        } else {
          console.log('[MultiplayerRoom] Room exists with different host:', hostTag);
          return false;
        }
      } else {
        // No existing room, current user becomes host
        console.log('[MultiplayerRoom] No existing room found, current user becomes host');
        return true;
      }
    } catch (error) {
      console.error('[MultiplayerRoom] Error checking host status:', error);
      return false;
    }
  }, [nostr, user, roomId]);

  // Publish host room event
  const publishHostRoomEvent = useCallback(async (): Promise<void> => {
    if (!user || !roomId || !gameId) {
      throw new Error('Missing required parameters for room creation');
    }

    console.log('[MultiplayerRoom] Publishing host room event...');

    try {
      const event = await publishEvent({
        kind: 31997,
        content: '',
        tags: [
          ['d', roomId],
          ['game', gameId],
          ['host', user.pubkey],
          ['status', 'waiting'],
          ['players', '2']
        ]
      });

      console.log('[MultiplayerRoom] Host room event published:', event.id);
      setCurrentRoomEventId(event.id);

      // Update room state
      const shareableLink = generateShareableLink(roomId);
      setRoomState(prev => ({
        ...prev,
        status: 'waiting_for_player',
        hostPubkey: user.pubkey,
        shareableLink,
        connectedPlayers: [{ pubkey: user.pubkey }]
      }));

      console.log('[MultiplayerRoom] Room state updated to waiting_for_player');

    } catch (error) {
      console.error('[MultiplayerRoom] Error publishing host room event:', error);
      setRoomState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to create room'
      }));
      throw error;
    }
  }, [user, roomId, gameId, publishEvent, generateShareableLink]);

  // Subscribe to room events and listen for guest responses
  const subscribeToRoomEvents = useCallback((): void => {
    if (!nostr || !roomId) return;

    console.log('[MultiplayerRoom] Subscribing to room events for roomId:', roomId);

    const pollForGuestEvents = async (): Promise<void> => {
      try {
        const events = await nostr.query([{
          kinds: [31997],
          '#d': [roomId],
          limit: 10
        }], { signal: AbortSignal.timeout(5000) });

        // Sort by created_at to get most recent events
        const sortedEvents = events.sort((a, b) => b.created_at - a.created_at);

        for (const event of sortedEvents) {
          // Skip our own events
          if (user && event.pubkey === user.pubkey) continue;

          // Log guest activity for now
          console.log('[MultiplayerRoom] Guest activity detected:', {
            eventId: event.id,
            guestPubkey: event.pubkey,
            createdAt: event.created_at,
            tags: event.tags
          });

          // TODO: In next phase, handle guest connection attempts here
        }

      } catch (error) {
        console.error('[MultiplayerRoom] Error polling for guest events:', error);
      }
    };

    // Initial poll
    pollForGuestEvents();

    // Set up periodic polling every 3 seconds
    const interval = setInterval(pollForGuestEvents, 3000);

    subscriptionRef.current = {
      close: () => {
        console.log('[MultiplayerRoom] Closing room event subscription');
        clearInterval(interval);
      }
    };

  }, [nostr, roomId, user]);

  // Set up host timeout (1 minute)
  const setupHostTimeout = useCallback((): void => {
    console.log('[MultiplayerRoom] Setting up host timeout (1 minute)');

    const timeout = setTimeout(() => {
      console.log('[MultiplayerRoom] Host timeout reached - no guest connected within 1 minute');
      setRoomState(prev => ({
        ...prev,
        status: 'waiting_to_retry'
      }));
    }, 60000); // 1 minute

    hostTimeoutRef.current = timeout;
  }, []);

  // Initialize room (host flow)
  const initializeRoom = useCallback(async (): Promise<void> => {
    if (!user || !roomId || !gameId || roomInitializedRef.current) return;

    console.log('[MultiplayerRoom] Initializing room...');
    roomInitializedRef.current = true;

    try {
      const shouldBeHost = await checkIfHost();
      setIsHost(shouldBeHost);

      if (shouldBeHost) {
        console.log('[MultiplayerRoom] Starting host flow');
        await publishHostRoomEvent();
        subscribeToRoomEvents();
        setupHostTimeout();
      } else {
        console.log('[MultiplayerRoom] Starting guest flow (not implemented yet)');
        // TODO: Implement guest flow in next phase
        setRoomState(prev => ({
          ...prev,
          status: 'waiting',
          error: 'Guest flow not implemented yet'
        }));
      }

    } catch (error) {
      console.error('[MultiplayerRoom] Error initializing room:', error);
      setRoomState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to initialize room'
      }));
    }
  }, [user, roomId, gameId, checkIfHost, publishHostRoomEvent, subscribeToRoomEvents, setupHostTimeout]);

  // Initialize room on mount
  useEffect(() => {
    console.log('[MultiplayerRoom] Hook initialized for room:', roomId, 'game:', gameId);
    initializeRoom();

    // Cleanup on unmount
    return () => {
      console.log('[MultiplayerRoom] Cleaning up multiplayer room hook');

      if (subscriptionRef.current) {
        subscriptionRef.current.close();
      }

      if (hostTimeoutRef.current) {
        clearTimeout(hostTimeoutRef.current);
      }

      // Reset initialization flag when dependencies change
      roomInitializedRef.current = false;
    };
  }, [initializeRoom]);

  // Dummy methods to keep UI functional (not implemented in this phase)
  const startGame = (): void => {
    console.log('[MultiplayerRoom] startGame called (not implemented yet)');
  };

  const sendGameInput = (): void => {
    console.log('[MultiplayerRoom] sendGameInput called (not implemented yet)');
  };

  const sendGameState = (): void => {
    console.log('[MultiplayerRoom] sendGameState called (not implemented yet)');
  };

  const sendChatMessage = (_message: string): void => {
    console.log('[MultiplayerRoom] sendChatMessage called (not implemented yet)');
  };

  const setEmulatorStartCallback = (_callback: () => void): void => {
    console.log('[MultiplayerRoom] setEmulatorStartCallback called (not implemented yet)');
  };

  const joinGame = (): void => {
    console.log('[MultiplayerRoom] joinGame called (not implemented yet)');
  };

  const retryConnection = (): void => {
    console.log('[MultiplayerRoom] retryConnection called (not implemented yet)');
  };

  return {
    roomState,
    startGame,
    isHost,
    webRTCConnection: null,
    localSignal: null,
    sendGameInput,
    sendGameState,
    sendChatMessage,
    setEmulatorStartCallback,
    joinGame,
    isJoining: false,
    connectionState: 'new' as RTCPeerConnectionState,
    iceConnectionState: 'new' as RTCIceConnectionState,
    isWebRTCConnected: false,
    hasConnectionTimedOut: roomState.status === 'waiting_to_retry',
    retryConnection
  };
}