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
  const hostPeerConnectionRef = useRef<RTCPeerConnection | null>(null); // Store host's peer connection
  const hostDataChannelRef = useRef<RTCDataChannel | null>(null); // Store host's data channel
  const guestDataChannelRef = useRef<RTCDataChannel | null>(null); // Store guest's data channel
  const emulatorStartCallbackRef = useRef<(() => void) | null>(null); // Store emulator start callback (deprecated)
  const hasPublishedAnswerRef = useRef(false); // Track whether guest has already published WebRTC answer

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

  // Generate WebRTC offer and return base64-encoded string
  const generateWebRTCOffer = useCallback(async (): Promise<string> => {
    console.log('[MultiplayerRoom] Generating WebRTC offer...');

    try {
      // Create a new RTCPeerConnection
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Store peer connection in ref for reuse
      hostPeerConnectionRef.current = peerConnection;

      // Create a data channel for game communication
      const dataChannel = peerConnection.createDataChannel('game-data');

      // Store data channel in ref for reuse and chat functionality
      hostDataChannelRef.current = dataChannel;

      // Set up data channel event handlers
      dataChannel.onopen = () => {
        console.log('[MultiplayerRoom] 📡 Host data channel opened with guest at:', new Date().toISOString());

        // Update state
        setRoomState(prev => {
          const nextState = { ...prev, isWebRTCConnected: true };
          console.log('[MultiplayerRoom] 🔥 set isWebRTCConnected: true (data channel open) at:', new Date().toISOString(), nextState);
          return nextState;
        });
      };

      dataChannel.onmessage = (event) => {
        console.log('[MultiplayerRoom] Host received message from guest:', event.data);

        try {
          // Parse the incoming message
          const messageData = JSON.parse(event.data);

          if (messageData.type === 'chat' && messageData.data) {
            console.log('[Chat][recv] 📥 Host received chat message:', messageData.data);

            // Add to chat messages
            setRoomState(prev => {
              const updatedMessages = [...(prev.chatMessages || []), messageData.data];
              console.log('[Chat][recv] ✅ Added received message to state:', messageData.data);
              return {
                ...prev,
                chatMessages: updatedMessages
              };
            });
          } else {
            console.log('[MultiplayerRoom] Host received non-chat message:', messageData.type);
          }
        } catch (error) {
          console.error('[MultiplayerRoom] Error parsing message from guest:', error);
        }
      };

      dataChannel.onclose = () => {
        console.log('[MultiplayerRoom] Host data channel closed with guest');
        setRoomState(prev => {
          const nextState = { ...prev, isWebRTCConnected: false };
          console.log('[MultiplayerRoom] ❌ set isWebRTCConnected: false (data channel close)', nextState);
          return nextState;
        });
      };

      dataChannel.onerror = (error) => {
        console.error('[MultiplayerRoom] Host data channel error:', error);
      };

      // Create offer
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });

      // Set local description
      await peerConnection.setLocalDescription(offer);

      // Wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('[MultiplayerRoom] ICE gathering timeout (fallback)');
          resolve();
        }, 3000); // tempo de segurança

        if (peerConnection.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve();
        } else {
          peerConnection.onicegatheringstatechange = () => {
            if (peerConnection.iceGatheringState === 'complete') {
              clearTimeout(timeout);
              resolve();
            }
          };
        }
      });

      // Get the complete offer with ICE candidates
      const completeOffer = peerConnection.localDescription;

      if (!completeOffer) {
        throw new Error('Failed to generate WebRTC offer');
      }

      // Do NOT close the connection - we'll reuse it for guest answers
      // peerConnection.close();

      // Serialize and base64 encode the offer
      const offerString = JSON.stringify(completeOffer);
      const base64Offer = btoa(offerString);

      console.log('[MultiplayerRoom] WebRTC offer generated and encoded');
      return base64Offer;

    } catch (error) {
      console.error('[MultiplayerRoom] Error generating WebRTC offer:', error);
      throw new Error('Failed to generate WebRTC offer');
    }
  }, []);

  // Publish host room event
  const publishHostRoomEvent = useCallback(async (): Promise<void> => {
    if (!user || !roomId || !gameId) {
      throw new Error('Missing required parameters for room creation');
    }

    console.log('[MultiplayerRoom] Publishing host room event...');

    try {
      const requiredPlayers = roomState.requiredPlayers || 2;

      // Generate WebRTC offer
      const webRTCOffer = await generateWebRTCOffer();

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
          ['players', requiredPlayers.toString()],
          ['signal', webRTCOffer]
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
        console.log('[MultiplayerRoom] Host subscription started, waiting for events...');
        for await (const msg of subscription) {
          console.log('[MultiplayerRoom] Host received message:', msg[0]);
          if (msg[0] === 'EVENT') {
            const event = msg[2] as NostrEvent;

            // Skip our own events (host events)
            if (event.pubkey === user.pubkey) continue;

            // Check if this is a valid guest event
            const guestTag = event.tags.find(t => t[0] === 'guest');
            const statusTag = event.tags.find(t => t[0] === 'status');
            const signalTag = event.tags.find(t => t[0] === 'signal');
            const eventRoomId = event.tags.find(t => t[0] === 'd')?.[1];
            const eventGameId = event.tags.find(t => t[0] === 'game')?.[1];
            const eventHostPubkey = event.tags.find(t => t[0] === 'host')?.[1];

            console.log('[MultiplayerRoom] Processing event from:', event.pubkey, {
              hasGuestTag: !!guestTag,
              status: statusTag?.[1],
              hasSignalTag: !!signalTag,
              eventRoomId,
              expectedRoomId: roomId,
              eventGameId,
              expectedGameId: gameId,
              eventHostPubkey,
              expectedHostPubkey: user.pubkey
            });

            // Validate event matches our filters - accept both 'active' status and any status with signal tag
            const isValidGuestEvent = guestTag &&
              eventRoomId === roomId &&
              eventGameId === gameId &&
              eventHostPubkey === user.pubkey &&
              ((statusTag && statusTag[1] === 'active') || signalTag);

            if (isValidGuestEvent) {
              // If this event has a signal tag, process WebRTC answer
              if (signalTag) {
                await processGuestWebRTCAnswer(event, guestTag[1]);
              }

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

                    // Immediately republish host room event with the new guest
                    console.log('[MultiplayerRoom] Calling republishHostRoomWithGuest for guest:', guestPubkey);
                    republishHostRoomWithGuest(guestPubkey, newConnectedPlayers);

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
        // Type assertion to ensure close method exists - cast to unknown first
        (subscription as unknown as { close: () => void }).close();
      }
    };

  }, [nostr, roomId, gameId, user, config.relayUrl]);

  // Host: Process guest's WebRTC answer and establish connection
  const processGuestWebRTCAnswer = useCallback(async (event: NostrEvent, guestPubkey: string): Promise<void> => {
    if (!user) {
      console.error('[MultiplayerRoom] Missing user context for WebRTC processing');
      return;
    }

    try {
      console.log('[MultiplayerRoom] Processing WebRTC answer from guest:', guestPubkey);

      // Check if we have an existing peer connection
      const peerConnection = hostPeerConnectionRef.current;
      if (!peerConnection) {
        console.error('[MultiplayerRoom] No existing peer connection found - cannot process guest answer');
        setRoomState(prev => ({
          ...prev,
          status: 'error',
          error: 'No WebRTC connection available - please recreate room'
        }));
        return;
      }

      // Validate event has required tags
      const hostTag = event.tags.find(t => t[0] === 'host');
      const signalTag = event.tags.find(t => t[0] === 'signal');

      if (!hostTag || hostTag[1] !== user.pubkey) {
        console.error('[MultiplayerRoom] Event host tag does not match current user');
        return;
      }

      if (!signalTag) {
        console.error('[MultiplayerRoom] Event missing signal tag');
        return;
      }

      const base64Answer = signalTag[1];
      console.log('[MultiplayerRoom] Received WebRTC answer from guest:', guestPubkey);

      // Decode and parse the answer
      const answerString = atob(base64Answer);
      const answer: RTCSessionDescriptionInit = JSON.parse(answerString);

      console.log('[MultiplayerRoom] WebRTC answer parsed successfully');

      // Set up connection state monitoring (if not already set)
      if (!peerConnection.onconnectionstatechange) {
        peerConnection.onconnectionstatechange = () => {
          console.log('[MultiplayerRoom] 🔌 WebRTC connection state changed:', peerConnection.connectionState, 'at:', new Date().toISOString());

          if (peerConnection.connectionState === 'connected') {
            console.log('[MultiplayerRoom] ✅ WebRTC connection established with guest:', guestPubkey);

            setRoomState(prev => {
              const nextState = { ...prev, isWebRTCConnected: true };
              console.log('[MultiplayerRoom] 🔥 set isWebRTCConnected: true (connectionState === connected) at:', new Date().toISOString(), nextState);
              return nextState;
            });
          } else if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
            console.warn('[MultiplayerRoom] ❌ WebRTC connection failed with guest:', guestPubkey);
            setRoomState(prev => {
              const nextState = { ...prev, isWebRTCConnected: false };
              console.log('[MultiplayerRoom] ❌ set isWebRTCConnected: false (connectionState failed/disconnected) at:', new Date().toISOString(), nextState);
              return nextState;
            });
          }
        };
      }

      // Set up ICE connection state monitoring (if not already set)
      if (!peerConnection.oniceconnectionstatechange) {
        peerConnection.oniceconnectionstatechange = () => {
          console.log('[MultiplayerRoom] ICE connection state changed:', peerConnection.iceConnectionState);
        };
      }

      // Apply the guest's answer as remote description
      await peerConnection.setRemoteDescription(answer);

      console.log('[MultiplayerRoom] Remote description set for guest:', guestPubkey);

      // Data channel was already created during offer generation
      // It will automatically connect once guest sets remote description
      const dataChannel = hostDataChannelRef.current;
      if (dataChannel) {
        console.log('[MultiplayerRoom] Data channel found and ready for guest:', guestPubkey);

        // Ensure event handlers are set (they should already be set from offer generation)
        if (!dataChannel.onopen) {
          dataChannel.onopen = () => {
            console.log('[MultiplayerRoom] Host data channel opened with guest:', guestPubkey);
            setRoomState(prev => {
              const nextState = { ...prev, isWebRTCConnected: true };
              console.log('[MultiplayerRoom] ✅ set isWebRTCConnected: true (data channel open - answer processing)', nextState);
              return nextState;
            });
          };
        }

        if (!dataChannel.onmessage) {
          dataChannel.onmessage = (event) => {
            console.log('[MultiplayerRoom] Host received message from guest:', guestPubkey, event.data);
            // TODO: Handle game data messages from guest
          };
        }
      } else {
        console.warn('[MultiplayerRoom] No data channel found in ref');
      }

      console.log('[MultiplayerRoom] WebRTC answer processing complete for guest:', guestPubkey);

      // Optional: Update host's event to mark this guest as connected
      // This can be done in a future iteration when supporting multiple guests

    } catch (error) {
      console.error('[MultiplayerRoom] Error processing guest WebRTC answer:', error);
      setRoomState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to establish WebRTC connection'
      }));
    }
  }, [user]);

  // Helper function to check if guest is already in latest published host event
  const isGuestInLatestHostEvent = useCallback(async (guestPubkey: string): Promise<boolean> => {
    if (!nostr || !roomId || !user) return false;

    try {
      console.log('[MultiplayerRoom] Checking if guest is in latest host event:', guestPubkey);

      // Query for the latest host event
      const connectedRelays = [config.relayUrl];
      const relayGroup = nostr.group(connectedRelays);

      const hostEvents = await relayGroup.query([{
        kinds: [31997],
        '#d': [roomId],
        authors: [user.pubkey],
        limit: 1
      }], { signal: AbortSignal.timeout(5000) });

      if (hostEvents.length === 0) {
        console.log('[MultiplayerRoom] No host events found, guest is not included');
        return false;
      }

      const latestHostEvent = hostEvents[0];
      console.log('[MultiplayerRoom] Found latest host event:', latestHostEvent.id);

      // Extract all guest tags from the latest host event
      const guestTags = latestHostEvent.tags.filter(t => t[0] === 'guest');
      const guestPubkeys = guestTags.map(t => t[1]);

      console.log('[MultiplayerRoom] Guest pubkeys in latest event:', guestPubkeys);

      // Check if the guest pubkey is already in the event
      const isGuestIncluded = guestPubkeys.includes(guestPubkey);
      console.log('[MultiplayerRoom] Guest', guestPubkey, 'is included in latest event:', isGuestIncluded);

      return isGuestIncluded;

    } catch (error) {
      console.error('[MultiplayerRoom] Error checking guest in latest host event:', error);
      // If we can't check, assume guest is not included to be safe
      return false;
    }
  }, [nostr, roomId, user, config.relayUrl]);

  // Host: Republish room event when a new guest joins
  const republishHostRoomWithGuest = useCallback(async (guestPubkey: string, currentConnectedPlayers: ConnectedPlayer[]): Promise<void> => {
    console.log('[MultiplayerRoom] republishHostRoomWithGuest called with guest:', guestPubkey, 'and players:', currentConnectedPlayers);

    if (!user || !roomId || !gameId) {
      console.error('[MultiplayerRoom] Missing required parameters for room republish');
      return;
    }

    // Check if guest is already in the latest published host event (not just local state)
    const isGuestInPublishedEvent = await isGuestInLatestHostEvent(guestPubkey);

    if (isGuestInPublishedEvent) {
      console.log('[MultiplayerRoom] Guest already included in latest published event, skipping republish:', guestPubkey);
      return;
    }

    console.log('[MultiplayerRoom] Guest not in published event, republishing with all guests:', guestPubkey);

    try {
      const offerSdp = hostPeerConnectionRef.current?.localDescription;
      const encodedOffer = offerSdp ? btoa(JSON.stringify(offerSdp)) : null;

      // Publish only to currently connected relay
      const connectedRelays = [config.relayUrl];

      // Build tags with all current connected players
      const tags = [
        ['d', roomId],
        ['game', gameId],
        ['host', user.pubkey],
        ['status', 'waiting_for_player'],
        ['players', roomState.requiredPlayers.toString()],
      ];

      // Add all current connected guest pubkeys as guest tags
      currentConnectedPlayers.forEach(player => {
        if (player.pubkey !== user.pubkey) { // Don't add host as guest
          tags.push(['guest', player.pubkey]);
        }
      });

      if (encodedOffer) {
        tags.push(['signal', encodedOffer]);
      } else {
        console.error('[MultiplayerRoom] ❌ Failed to encode offer: offer SDP is missing.');
        return; // ou throw, dependendo do seu fluxo
      }

      const event = await publishEvent({
        kind: 31997,
        content: '',
        tags,
        relays: connectedRelays
      });

      console.log('[MultiplayerRoom] Host room republished with new guest:', event.id);
      setCurrentRoomEventId(event.id);

    } catch (error) {
      console.error('[MultiplayerRoom] Error republishing host room with guest:', error);
    }
  }, [user, roomId, gameId, publishEvent, roomState.requiredPlayers, config.relayUrl, isGuestInLatestHostEvent]);

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

  // Guest: Generate WebRTC answer from host offer and publish response
  const generateAndPublishWebRTCAnswer = useCallback(async (hostEvent: NostrEvent): Promise<void> => {
    if (!user || !roomId || !gameId) {
      console.error('[MultiplayerRoom] Missing required parameters for WebRTC answer');
      return;
    }

    // Check if answer has already been published in this session
    if (hasPublishedAnswerRef.current) {
      console.log('[MultiplayerRoom] ⚠️ Guest already published answer. Skipping duplicate publication to prevent InvalidStateError...');
      return;
    }

    try {
      // Extract the host's WebRTC offer from the signal tag
      const signalTag = hostEvent.tags.find(t => t[0] === 'signal');
      const hostTag = hostEvent.tags.find(t => t[0] === 'host');

      if (!signalTag || !hostTag) {
        console.error('[MultiplayerRoom] Host event missing signal or host tag');
        return;
      }

      const base64Offer = signalTag[1];
      const hostPubkey = hostTag[1];

      console.log('[MultiplayerRoom] Processing WebRTC offer from host:', hostPubkey);

      // Decode and parse the offer
      const offerString = atob(base64Offer);
      const offer: RTCSessionDescriptionInit = JSON.parse(offerString);

      // Create a new RTCPeerConnection for the guest
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Set up data channel listener to handle host's data channel
      peerConnection.ondatachannel = (event) => {
        const dataChannel = event.channel;
        console.log('[MultiplayerRoom] Data channel received from host:', dataChannel.label);

        // Store data channel reference for chat functionality
        guestDataChannelRef.current = dataChannel;

        // Set up data channel event handlers
        dataChannel.onopen = () => {
          console.log('[MultiplayerRoom] Guest data channel opened with host');
          setRoomState(prev => {
            const nextState = { ...prev, isWebRTCConnected: true };
            console.log('[MultiplayerRoom] ✅ set isWebRTCConnected: true (dataChannel.onopen)', nextState);
            return nextState;
          });
        };

        dataChannel.onmessage = (event) => {
          console.log('[MultiplayerRoom] Received message from host:', event.data);

          try {
            // Parse the incoming message
            const messageData = JSON.parse(event.data);

            if (messageData.type === 'chat' && messageData.data) {
              console.log('[Chat][recv] 📥 Guest received chat message:', messageData.data);

              // Add to chat messages
              setRoomState(prev => {
                const updatedMessages = [...(prev.chatMessages || []), messageData.data];
                console.log('[Chat][recv] ✅ Added received message to state:', messageData.data);
                return {
                  ...prev,
                  chatMessages: updatedMessages
                };
              });
            } else {
              console.log('[MultiplayerRoom] Guest received non-chat message:', messageData.type);
            }
          } catch (error) {
            console.error('[MultiplayerRoom] Error parsing message from host:', error);
          }
        };

        dataChannel.onclose = () => {
          console.log('[MultiplayerRoom] Guest data channel closed with host');
          setRoomState(prev => {
            const nextState = { ...prev, isWebRTCConnected: false };
            console.log('[MultiplayerRoom] ❌ set isWebRTCConnected: false (dataChannel.onclose)', nextState);
            return nextState;
          });
        };

        dataChannel.onerror = (error) => {
          console.error('[MultiplayerRoom] Data channel error:', error);
        };
      };

      // Set the remote description with the host's offer
      await peerConnection.setRemoteDescription(offer);

      // Create an answer
      const answer = await peerConnection.createAnswer();

      // Set the local description
      await peerConnection.setLocalDescription(answer);

      // Wait for ICE gathering to complete with timeout fallback
      await Promise.race([
        new Promise<void>((resolve) => {
          if (peerConnection.iceGatheringState === 'complete') {
            resolve();
          } else {
            peerConnection.onicegatheringstatechange = () => {
              if (peerConnection.iceGatheringState === 'complete') {
                resolve();
              }
            };
          }
        }),
        new Promise<void>((resolve) => {
          setTimeout(() => {
            console.log('[MultiplayerRoom] ICE gathering timeout, using current candidates');
            resolve();
          }, 5000); // 5 second timeout
        })
      ]);

      // Get the complete answer with ICE candidates
      const completeAnswer = peerConnection.localDescription;

      if (!completeAnswer) {
        throw new Error('Failed to generate WebRTC answer');
      }

      // Serialize and base64 encode the answer
      const answerString = JSON.stringify(completeAnswer);
      const base64Answer = btoa(answerString);

      console.log('[MultiplayerRoom] WebRTC answer generated and encoded');

      // Publish the answer back to the relay (this is the ONLY event the guest publishes)
      const connectedRelays = [config.relayUrl];

      const answerEvent = await publishEvent({
        kind: 31997,
        content: '',
        tags: [
          ['d', roomId],
          ['game', gameId],
          ['host', hostPubkey],
          ['guest', user.pubkey],
          ['status', 'active'],
          ['signal', base64Answer]
        ],
        relays: connectedRelays
      });

      console.log('[MultiplayerRoom] WebRTC answer published to relay:', answerEvent.id);
      setCurrentRoomEventId(answerEvent.id);

      // Mark that answer has been published to prevent duplicates
      hasPublishedAnswerRef.current = true;
      console.log('[MultiplayerRoom] ✅ Answer published successfully, marked hasPublishedAnswerRef = true');

      // Keep the peer connection reference for future use
      // TODO: Store peer connection reference for game communication

    } catch (error) {
      console.error('[MultiplayerRoom] Error generating WebRTC answer:', error);
      setRoomState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to establish WebRTC connection'
      }));
    }
  }, [user, roomId, gameId, publishEvent, config.relayUrl]);

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
            const signalTag = event.tags.find(t => t[0] === 'signal');

            if (hostTag && statusTag) {
              const status = statusTag[1];

              // Check if this is a host event with a WebRTC offer (signal tag)
              if (signalTag && (status === 'waiting' || status === 'waiting_for_player')) {
                console.log('[MultiplayerRoom] Host event with WebRTC offer detected, generating answer...');

                // Generate and publish WebRTC answer
                await generateAndPublishWebRTCAnswer(event);

                // Continue listening for more events in case host republishes
                continue;
              }

              // Handle room full status
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
        // Type assertion to ensure close method exists - cast to unknown first
        (subscription as unknown as { close: () => void }).close();
      }
    };

  }, [nostr, roomId, user, config.relayUrl, generateAndPublishWebRTCAnswer]);

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

  // Guest: Prepare guest flow (no longer publishes an event)
  const prepareGuestFlow = useCallback(async (hostEvent: NostrEvent): Promise<void> => {
    if (!user || !roomId || !gameId) {
      throw new Error('Missing required parameters for guest flow');
    }

    console.log('[MultiplayerRoom] Guest preparing flow...');

    // Extract host info from host event
    const hostTag = hostEvent.tags.find(t => t[0] === 'host');
    const hostPubkey = hostTag?.[1];

    if (!hostPubkey) {
      throw new Error('Invalid host event: missing host tag');
    }

    try {
      // Update room state locally (no event publication yet)
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

      console.log('[MultiplayerRoom] Guest room state updated to active (waiting for WebRTC)');

    } catch (error) {
      console.error('[MultiplayerRoom] Error preparing guest flow:', error);
      setRoomState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to prepare guest flow'
      }));
      throw error;
    }
  }, [user, roomId, gameId, generateShareableLink]);

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

      // Step 2: Prepare guest flow (update local state, no event publication)
      await prepareGuestFlow(hostEvent);

      // Step 3: Subscribe to room events to monitor host responses and WebRTC offers
      subscribeToGuestRoomEvents();

    } catch (error) {
      console.error('[MultiplayerRoom] Error in guest flow:', error);
      setRoomState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to join room'
      }));
    }
  }, [fetchHostRoomEvent, prepareGuestFlow, subscribeToGuestRoomEvents]);

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

  // Monitor roomState.isWebRTCConnected changes
  useEffect(() => {
    console.log('[MultiplayerRoom] roomState.isWebRTCConnected changed:', roomState.isWebRTCConnected);
  }, [roomState.isWebRTCConnected]);

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

      // Reset answer publication flag for fresh sessions
      hasPublishedAnswerRef.current = false;
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

  const sendChatMessage = (message: string): void => {
    if (!user || !message.trim()) {
      console.log('[Chat][send] ❌ Cannot send message: no user or empty message');
      return;
    }

    console.log('[Chat][send] 📤 Sending chat message:', message);

    // Create chat message object
    const chatMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sender: user.pubkey,
      message: message.trim(),
      timestamp: Date.now(),
      senderName: undefined // Will be resolved by UI component using useAuthor
    };

    // Update local state immediately
    setRoomState(prev => {
      const updatedMessages = [...(prev.chatMessages || []), chatMessage];
      console.log('[Chat][send] ✅ Added message to local state:', chatMessage);
      return {
        ...prev,
        chatMessages: updatedMessages
      };
    });

    // Send via WebRTC data channel
    try {
      const dataChannel = isHost ? hostDataChannelRef.current : guestDataChannelRef.current;

      if (dataChannel && dataChannel.readyState === 'open') {
        const messageData = JSON.stringify({
          type: 'chat',
          data: chatMessage
        });
        dataChannel.send(messageData);
        console.log('[Chat][send] ✅ Message sent via WebRTC data channel');
      } else {
        console.warn('[Chat][send] ❌ Data channel not available or not open:', dataChannel?.readyState);
      }
    } catch (error) {
      console.error('[Chat][send] ❌ Error sending message via WebRTC:', error);
    }
  };

  const setEmulatorStartCallback = (callback: () => void): void => {
    console.log('[MultiplayerRoom] 🔧 setEmulatorStartCallback called (deprecated) at:', new Date().toISOString());
    // This method is deprecated but kept for compatibility
    emulatorStartCallbackRef.current = callback;
    console.log('[MultiplayerRoom] ⚠️ setEmulatorStartCallback is deprecated - emulator is now started directly');
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
    isWebRTCConnected: roomState.isWebRTCConnected || false,
    hasConnectionTimedOut: roomState.status === 'waiting_to_retry',
    retryConnection
  };
}