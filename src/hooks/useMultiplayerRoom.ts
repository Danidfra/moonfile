import { useState, useEffect, useRef, useCallback } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import { useAppContext } from './useAppContext';
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
  status: 'waiting' | 'active' | 'full' | 'error' | 'playing' | 'waiting_for_player' | 'waiting_to_retry' | 'room_full';
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
  const { config } = useAppContext();

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
  const guestEventsRef = useRef<NostrEvent[]>([]); // Track guest events in order
  const isListeningForGuestsRef = useRef(false); // Track if host is still listening for guests
  const subscriptionIdRef = useRef<string | null>(null); // Track subscription ID for CLOSE message

  // Generate shareable link
  const generateShareableLink = useCallback((roomId: string): string => {
    return `${window.location.origin}/multiplayer/${gameId}/${roomId}`;
  }, [gameId]);

  // Check if current user should be host
  const checkIfHost = useCallback(async (): Promise<boolean> => {
    if (!nostr || !user || !roomId) return false;

    try {
      // Check if room already exists (only from connected relay)
      const connectedRelays = [config.relayUrl];
      const relayGroup = nostr.group(connectedRelays);

      const existingEvents = await relayGroup.query([{
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
  }, [nostr, user, roomId, config.relayUrl]);

  // Publish host room event
  const publishHostRoomEvent = useCallback(async (): Promise<void> => {
    if (!user || !roomId || !gameId) {
      throw new Error('Missing required parameters for room creation');
    }

    console.log('[MultiplayerRoom] Publishing host room event...');

    try {
      const requiredPlayers = roomState.requiredPlayers || 2;

      // Publish only to the currently connected relay
      const connectedRelays = [config.relayUrl];

      const event = await publishEvent({
        kind: 31997,
        content: '',
        tags: [
          ['d', roomId],
          ['game', gameId],
          ['host', user.pubkey],
          ['status', 'waiting'],
          ['players', requiredPlayers.toString()]
        ],
        relays: connectedRelays, // Specify which relays to publish to
        created_at: Math.floor(Date.now() / 1000)
      });

      console.log('[MultiplayerRoom] Host room event published to connected relays:', event.id);
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
  }, [user, roomId, gameId, publishEvent, generateShareableLink, roomState.requiredPlayers, config.relayUrl]);

  // Host: Subscribe to room events and listen for guest responses using proper Nostr subscription
  const subscribeToHostGuestEvents = useCallback((): void => {
    if (!nostr || !roomId || !user || !isListeningForGuestsRef.current) return;

    console.log('[MultiplayerRoom] Host subscribing to guest events for roomId:', roomId);

    // Create a relay group with only connected relays
    const connectedRelays = [config.relayUrl];
    const relayGroup = nostr.group(connectedRelays);

    // Define the filter for guest events
    const filter = {
      kinds: [31997],
      '#d': [roomId],
      limit: 20
    };

    console.log('[MultiplayerRoom] Creating REQ subscription:', { filter });

    // Create the subscription using req() - this sends a single REQ message
    const subscription = relayGroup.req([filter]);

    // Handle subscription events
    (async () => {
      try {
        for await (const msg of subscription) {
          if (msg[0] === 'EVENT') {
            const event = msg[2] as NostrEvent;

            // Skip our own events (host events)
            if (event.pubkey === user.pubkey) continue;

            // Check if this is a valid guest event
            const guestTag = event.tags.find(t => t[0] === 'guest');
            const statusTag = event.tags.find(t => t[0] === 'status' && t[1] === 'active');
            const eventRoomId = event.tags.find(t => t[0] === 'd')?.[1];
            const eventGameId = event.tags.find(t => t[0] === 'game')?.[1];
            const eventHostPubkey = event.tags.find(t => t[0] === 'host')?.[1];

            // Validate event matches our filters
            if (guestTag && statusTag &&
                eventRoomId === roomId &&
                eventGameId === gameId &&
                eventHostPubkey === user.pubkey) {

              const guestPubkey = guestTag[1];

              // Check if we've already processed this guest event
              const isAlreadyProcessed = guestEventsRef.current.some(
                processedEvent => processedEvent.id === event.id
              );

              if (!isAlreadyProcessed) {
                console.log('[MultiplayerRoom] Valid guest event detected via subscription:', {
                  eventId: event.id,
                  guestPubkey,
                  timestamp: event.created_at
                });

                // Add to processed events
                guestEventsRef.current.push(event);

                // Update room state to include guest
                setRoomState(prev => {
                  const isGuestAlreadyConnected = prev.connectedPlayers.some(p => p.pubkey === guestPubkey);

                  if (!isGuestAlreadyConnected) {
                    const newConnectedPlayers = [...prev.connectedPlayers, { pubkey: guestPubkey }];
                    const currentGuestCount = newConnectedPlayers.length - 1; // Exclude host
                    const requiredGuests = prev.requiredPlayers - 1; // Exclude host

                    console.log('[MultiplayerRoom] Guest added to room:', {
                      guestPubkey,
                      currentGuestCount,
                      requiredGuests
                    });

                    // Check if we've reached the required number of players
                    if (currentGuestCount >= requiredGuests && isListeningForGuestsRef.current) {
                      console.log('[MultiplayerRoom] Room is now full, stopping guest listening');
                      isListeningForGuestsRef.current = false;

                      // Schedule room completion update and subscription close
                      setTimeout(() => {
                        updateHostRoomWithGuests(newConnectedPlayers);
                        closeHostSubscription();
                      }, 0);

                      return {
                        ...prev,
                        status: 'room_full',
                        connectedPlayers: newConnectedPlayers
                      };
                    }

                    return {
                      ...prev,
                      status: 'active',
                      connectedPlayers: newConnectedPlayers
                    };
                  }

                  return prev;
                });
              }
            }
          } else if (msg[0] === 'EOSE') {
            console.log('[MultiplayerRoom] Host guest event subscription received EOSE - continuing to listen for more events');
            // Do NOT break or close the subscription - keep listening for late guest connections
          }
        }
      } catch (error) {
        console.error('[MultiplayerRoom] Host guest event subscription error:', error);
      }
    })();

    subscriptionRef.current = {
      close: () => {
        console.log('[MultiplayerRoom] Closing host guest event subscription');
        // Type assertion to ensure close method exists
        (subscription as { close: () => void }).close();
      }
    };

  }, [nostr, roomId, gameId, user, config.relayUrl]);

  // Host: Update room event with connected guests
  const updateHostRoomWithGuests = useCallback(async (connectedPlayers: ConnectedPlayer[]): Promise<void> => {
    if (!user || !roomId || !gameId || !currentRoomEventId) {
      console.error('[MultiplayerRoom] Missing required parameters for room update');
      return;
    }

    console.log('[MultiplayerRoom] Updating host room event with connected guests:', connectedPlayers);

    try {
      // Publish only to currently connected relay
      const connectedRelays = [config.relayUrl];

      // Build tags with connected players
      const tags = [
        ['d', roomId],
        ['game', gameId],
        ['host', user.pubkey],
        ['status', 'full'],
        ['players', roomState.requiredPlayers.toString()]
      ];

      // Add connected guest pubkeys as tags
      connectedPlayers.forEach(player => {
        if (player.pubkey !== user.pubkey) { // Don't add host as connected
          tags.push(['connected', player.pubkey]);
        }
      });

      const event = await publishEvent({
        kind: 31997,
        content: '',
        tags,
        relays: connectedRelays // Specify which relays to publish to
      });

      console.log('[MultiplayerRoom] Host room updated with guests:', event.id);
      setCurrentRoomEventId(event.id);

      // Update final room state
      setRoomState(prev => ({
        ...prev,
        status: 'full',
        connectedPlayers
      }));

      // Close subscription to stop listening for more guests
      if (subscriptionRef.current) {
        subscriptionRef.current.close();
        subscriptionRef.current = null;
      }

    } catch (error) {
      console.error('[MultiplayerRoom] Error updating host room with guests:', error);
      setRoomState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to update room'
      }));
    }
  }, [user, roomId, gameId, publishEvent, roomState.requiredPlayers, currentRoomEventId, config.relayUrl]);

  // Host: Close subscription and send CLOSE message
  const closeHostSubscription = useCallback((): void => {
    if (subscriptionRef.current && subscriptionIdRef.current) {
      console.log('[MultiplayerRoom] Closing host subscription with CLOSE message:', subscriptionIdRef.current);

      // This will send a CLOSE message to relay
      subscriptionRef.current.close();
      subscriptionRef.current = null;
      subscriptionIdRef.current = null;
    }
  }, []);

  // Guest: Close subscription and send CLOSE message
  const closeGuestSubscription = useCallback((): void => {
    if (subscriptionRef.current && subscriptionIdRef.current) {
      console.log('[MultiplayerRoom] Closing guest subscription with CLOSE message:', subscriptionIdRef.current);

      // This will send a CLOSE message to relay
      subscriptionRef.current.close();
      subscriptionRef.current = null;
      subscriptionIdRef.current = null;
    }
  }, []);

  // Guest: Subscribe to room events to monitor host responses using proper Nostr subscription
  const subscribeToGuestRoomEvents = useCallback((): void => {
    if (!nostr || !roomId) return;

    console.log('[MultiplayerRoom] Guest subscribing to room events for roomId:', roomId);

    // Create a relay group with only connected relays
    const connectedRelays = [config.relayUrl];
    const relayGroup = nostr.group(connectedRelays);

    // Generate unique subscription ID
    const subscriptionId = `multiplayer-guest-${roomId}-${Date.now()}`;
    subscriptionIdRef.current = subscriptionId;

    // Define the filter for host events
    const filter = {
      kinds: [31997],
      '#d': [roomId],
      limit: 10
    };

    console.log('[MultiplayerRoom] Creating REQ subscription for guest:', {
      subscriptionId,
      filter
    });

    // Create the subscription using req() - this sends a single REQ message
    const subscription = relayGroup.req([filter]);

    // Handle subscription events manually
    (async () => {
      try {
        for await (const msg of subscription) {
          if (msg[0] === 'EVENT') {
            const event = msg[2] as NostrEvent;

            // Skip our own events
            if (user && event.pubkey === user.pubkey) continue;

            const hostTag = event.tags.find(t => t[0] === 'host');
            const statusTag = event.tags.find(t => t[0] === 'status');

            if (hostTag && statusTag) {
              const status = statusTag[1];

              if (status === 'full') {
                console.log('[MultiplayerRoom] Room is now full, status updated');
                setRoomState(prev => ({
                  ...prev,
                  status: 'full'
                }));
                // Close subscription since we got what we needed
                closeGuestSubscription();
                break;
              }
            }
          } else if (msg[0] === 'CLOSED') {
            console.log('[MultiplayerRoom] Guest room event subscription closed');
            subscriptionIdRef.current = null;
            break;
          }
        }
      } catch (error: unknown) {
        console.error('[MultiplayerRoom] Guest room event subscription error:', error);
      }
    })();

    subscriptionRef.current = {
      close: () => {
        console.log('[MultiplayerRoom] Closing guest subscription');
        // Type assertion to ensure close method exists
        (subscription as { close: () => void }).close();
      }
    };

  }, [nostr, roomId, user, config.relayUrl]);

  // Guest: Fetch host room event and validate room exists
  const fetchHostRoomEvent = useCallback(async (): Promise<NostrEvent | null> => {
    if (!nostr || !roomId) return null;

    console.log('[MultiplayerRoom] Guest fetching host room event...');

    try {
      // Query only from connected relay
      const connectedRelays = [config.relayUrl];
      const relayGroup = nostr.group(connectedRelays);

      const events = await relayGroup.query([{
        kinds: [31997],
        '#d': [roomId],
        limit: 10
      }], { signal: AbortSignal.timeout(30000) }); // 30 second timeout

      // Sort by created_at to get most recent events
      const sortedEvents = events.sort((a, b) => b.created_at - a.created_at);

      // Find the host event (should have 'host' tag)
      for (const event of sortedEvents) {
        const hostTag = event.tags.find(t => t[0] === 'host');
        const statusTag = event.tags.find(t => t[0] === 'status');

        if (hostTag && statusTag) {
          const status = statusTag[1];
          const playersTag = event.tags.find(t => t[0] === 'players');
          const requiredPlayers = playersTag ? parseInt(playersTag[1], 10) : 2;

          console.log('[MultiplayerRoom] Found host room event:', {
            eventId: event.id,
            hostPubkey: hostTag[1],
            status,
            requiredPlayers,
            createdAt: event.created_at
          });

          // Validate room is available for joining
          if (status === 'waiting' || status === 'waiting_for_player') {
            // Check if current user is already connected as a guest
            const isAlreadyConnected = event.tags.some(t =>
              t[0] === 'guest' && t[1] === user?.pubkey
            );

            if (isAlreadyConnected) {
              throw new Error('You are already connected to this room');
            }

            // Check if room is already full by counting guest players
            const guestTags = event.tags.filter(t => t[0] === 'guest');
            const currentPlayerCount = guestTags.length;

            if (currentPlayerCount >= requiredPlayers) {
              throw new Error('Room is full');
            }

            return event;
          } else {
            throw new Error(`Room is not available for joining (status: ${status})`);
          }
        }
      }

      console.log('[MultiplayerRoom] No host room event found');
      return null;

    } catch (error) {
      console.error('[MultiplayerRoom] Error fetching host room event:', error);
      throw error;
    }
  }, [nostr, roomId, config.relayUrl]);

  // Guest: Publish answer event to join the room
  const publishGuestAnswerEvent = useCallback(async (hostEvent: NostrEvent): Promise<void> => {
    if (!user || !roomId || !gameId) {
      throw new Error('Missing required parameters for guest answer');
    }

    console.log('[MultiplayerRoom] Guest publishing answer event...');

    // Extract host info from host event
    const hostTag = hostEvent.tags.find(t => t[0] === 'host');
    const hostPubkey = hostTag?.[1];

    if (!hostPubkey) {
      throw new Error('Invalid host event: missing host tag');
    }

    try {
      // Publish only to currently connected relay
      const connectedRelays = [config.relayUrl];

      const event = await publishEvent({
        kind: 31997,
        content: '',
        tags: [
          ['d', roomId],
          ['game', gameId],
          ['host', hostPubkey],
          ['guest', user.pubkey],
          ['status', 'active']
        ],
        relays: connectedRelays // Specify which relays to publish to
      });

      console.log('[MultiplayerRoom] Guest answer event published to connected relays:', event.id);
      setCurrentRoomEventId(event.id);

      // Update room state
      const shareableLink = generateShareableLink(roomId);
      setRoomState(prev => ({
        ...prev,
        status: 'active',
        hostPubkey,
        shareableLink,
        connectedPlayers: [
          { pubkey: hostPubkey }, // Host
          { pubkey: user.pubkey }  // Guest (self)
        ]
      }));

      console.log('[MultiplayerRoom] Guest room state updated to active');

    } catch (error) {
      console.error('[MultiplayerRoom] Error publishing guest answer event:', error);
      setRoomState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to join room'
      }));
      throw error;
    }
  }, [user, roomId, gameId, publishEvent, generateShareableLink]);

  // Guest: Initialize guest flow
  const initializeGuestFlow = useCallback(async (): Promise<void> => {
    console.log('[MultiplayerRoom] Starting guest flow...');

    try {
      // Step 1: Fetch host room event
      const hostEvent = await fetchHostRoomEvent();

      if (!hostEvent) {
        setRoomState(prev => ({
          ...prev,
          status: 'error',
          error: 'Room not found'
        }));
        return;
      }

      // Step 2: Publish guest answer event
      await publishGuestAnswerEvent(hostEvent);

      // Step 3: Subscribe to room events to monitor host responses
      subscribeToGuestRoomEvents();

    } catch (error) {
      console.error('[MultiplayerRoom] Error in guest flow:', error);
      setRoomState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to join room'
      }));
    }
  }, [fetchHostRoomEvent, publishGuestAnswerEvent, subscribeToGuestRoomEvents]);

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
        isListeningForGuestsRef.current = true; // Start listening for guests
        guestEventsRef.current = []; // Reset guest events
        await publishHostRoomEvent();
        subscribeToHostGuestEvents();
        setupHostTimeout();
      } else {
        console.log('[MultiplayerRoom] Starting guest flow');
        await initializeGuestFlow();
      }

    } catch (error) {
      console.error('[MultiplayerRoom] Error initializing room:', error);
      setRoomState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to initialize room'
      }));
    }
  }, [user, roomId, gameId, checkIfHost, publishHostRoomEvent, subscribeToHostGuestEvents, setupHostTimeout, initializeGuestFlow]);

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

      // Reset initialization flag and listening state when dependencies change
      roomInitializedRef.current = false;
      isListeningForGuestsRef.current = false;
      guestEventsRef.current = [];
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