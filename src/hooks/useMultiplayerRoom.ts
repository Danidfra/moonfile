import { useState, useEffect, useCallback, useRef } from 'react';
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
  latestEvent: NostrEvent | null;
  error?: string;
  shareableLink?: string;
  isWebRTCConnected?: boolean;
  chatMessages?: ChatMessage[];
  pendingHostSignal?: string;
  canJoinGame?: boolean;
}

export function useMultiplayerRoom(roomId: string, gameId: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();

  const [roomState, setRoomState] = useState<RoomState>({
    status: 'waiting',
    hostPubkey: '',
    requiredPlayers: 2,
    connectedPlayers: [],
    latestEvent: null,
    isWebRTCConnected: false,
    chatMessages: [],
    pendingHostSignal: undefined,
    canJoinGame: false,
  });

  const [webRTCConnection, setWebRTCConnection] = useState<RTCPeerConnection | null>(null);
  const [localSignal, setLocalSignal] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const [onEmulatorStart, setOnEmulatorStart] = useState<(() => void) | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [iceConnectionState, setIceConnectionState] = useState<RTCIceConnectionState>('new');
  const [isJoining, setIsJoining] = useState(false);
  const [connectionTimeout, setConnectionTimeout] = useState<NodeJS.Timeout | null>(null);
  const [hasConnectionTimedOut, setHasConnectionTimedOut] = useState(false);
  const [processedEvents, setProcessedEvents] = useState<Set<string>>(new Set());
  const [processedPeerSignals, setProcessedPeerSignals] = useState<Set<string>>(new Set());
  const [isConnectionEstablished, setIsConnectionEstablished] = useState(false);
  const [connectionHealthCheck, setConnectionHealthCheck] = useState<NodeJS.Timeout | null>(null);
  const [isWaitingForLateAnswers, setIsWaitingForLateAnswers] = useState(false);

  const subscriptionRef = useRef<{ close: () => void } | null>(null);
  const alreadyPublishedRef = useRef<boolean>(false);

  // Parse room event from Nostr event
  const parseRoomEvent = useCallback((event: NostrEvent, currentHostPubkey?: string): RoomState => {
    const dTag = event.tags.find(t => t[0] === 'd')?.[1];
    const gameTag = event.tags.find(t => t[0] === 'game')?.[1];
    const playersTag = event.tags.find(t => t[0] === 'players')?.[1];
    const hostTag = event.tags.find(t => t[0] === 'host')?.[1] || currentHostPubkey;
    const statusTag = event.tags.find(t => t[0] === 'status')?.[1];
    const signalTag = event.tags.find(t => t[0] === 'signal')?.[1];
    const connectedCountTag = event.tags.find(t => t[0] === 'connected_count')?.[1];

    if (!dTag || !gameTag || !playersTag || !hostTag) {
      throw new Error('Invalid room event: missing required tags');
    }

    const requiredPlayers = parseInt(playersTag, 10);
    if (isNaN(requiredPlayers) || requiredPlayers < 1) {
      throw new Error('Invalid players count');
    }

    // Parse connected players, ensuring no duplicates
    const connectedPlayers: ConnectedPlayer[] = [];
    const seenPubkeys = new Set<string>();

    // Always add host first with their signal
    if (!seenPubkeys.has(hostTag)) {
      connectedPlayers.push({
        pubkey: hostTag,
        signal: signalTag
      });
      seenPubkeys.add(hostTag);
    }

    // Add connected players from tags (excluding host)
    const connectedTags = event.tags
      .filter(t => t[0] === 'connected' && t[1] && t[1] !== hostTag)
      .map(t => t[1]);

    // Remove duplicates from connectedTags
    const uniqueConnectedTags = [...new Set(connectedTags)];

    for (const connectedPubkey of uniqueConnectedTags) {
      if (!seenPubkeys.has(connectedPubkey)) {
        const playerSignal = event.tags.find(t => t[0] === 'player' && t[1] === connectedPubkey)?.[2];
        connectedPlayers.push({
          pubkey: connectedPubkey,
          signal: playerSignal
        });
        seenPubkeys.add(connectedPubkey);
      }
    }

    const connectedCount = connectedCountTag ? parseInt(connectedCountTag, 10) : connectedPlayers.length;

    return {
      status: statusTag as 'waiting' | 'active' | 'full' || 'waiting',
      hostPubkey: hostTag,
      requiredPlayers,
      connectedPlayers,
      latestEvent: event,
      isWebRTCConnected: roomState.isWebRTCConnected, // Preserve existing WebRTC connection state
      chatMessages: roomState.chatMessages, // Preserve existing chat messages
      shareableLink: roomState.shareableLink, // Preserve shareable link
      pendingHostSignal: roomState.pendingHostSignal, // Preserve pending host signal
      canJoinGame: roomState.canJoinGame, // Preserve can join game state
      error: roomState.error, // Preserve error state
    };
  }, [roomState.isWebRTCConnected, roomState.chatMessages, roomState.shareableLink, roomState.pendingHostSignal, roomState.canJoinGame, roomState.error]);

  // Subscribe to room updates - get latest event
  const fetchLatestRoomEvent = useCallback(async () => {
    if (!nostr || !roomId) return null;

    try {
      const events = await nostr.query([{
        kinds: [31997],
        '#d': [roomId],
        limit: 10
      }], {
        signal: AbortSignal.timeout(5000)
      });

      // Sort by created_at to get the most recent
      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];

      if (latestEvent) {
        console.log('[MultiplayerRoom] Latest room event:', latestEvent.id);
        return latestEvent;
      }

      return null;
    } catch (error) {
      console.error('[MultiplayerRoom] Error fetching latest room event:', error);
      return null;
    }
  }, [nostr, roomId]);

  // Subscribe to room updates
  const subscribeToRoom = useCallback(async () => {
    if (!nostr || !roomId) return;

    console.log('[MultiplayerRoom] Subscribing to room updates:', roomId);

    const pollRoomState = async () => {
      try {
        const latestEvent = await fetchLatestRoomEvent();

        if (latestEvent) {
          // Skip if we've already processed this event
          if (processedEvents.has(latestEvent.id)) {
            console.log('[MultiplayerRoom] Skipping already processed event:', latestEvent.id);
            return;
          }

          try {
            const newRoomState = parseRoomEvent(latestEvent, roomState.hostPubkey);
            setRoomState(prev => ({
              ...newRoomState,
              // Preserve all existing state properties that shouldn't be overwritten
              shareableLink: prev.shareableLink,
              isWebRTCConnected: prev.isWebRTCConnected, // Preserve WebRTC connection state
              chatMessages: prev.chatMessages, // Preserve chat messages
              pendingHostSignal: prev.pendingHostSignal, // Preserve pending host signal
              canJoinGame: prev.canJoinGame, // Preserve can join game state
              error: prev.error, // Preserve error state
            }));

            // Mark event as processed
            setProcessedEvents(prev => new Set([...prev, latestEvent.id]));

            // Check for host signal if we're not the host
            if (user && latestEvent.pubkey !== user.pubkey && !isHost) {
              const signalTag = latestEvent.tags.find(t => t[0] === 'signal')?.[1];
              const hostTag = latestEvent.tags.find(t => t[0] === 'host')?.[1];

              // If this is a signal from the host and we haven't joined yet
              if (signalTag && hostTag && latestEvent.pubkey === hostTag && !localSignal) {
                console.log('[MultiplayerRoom] Host signal detected, enabling Join Game button');
                setRoomState(prev => ({
                  ...prev,
                  pendingHostSignal: signalTag,
                  canJoinGame: true
                }));
              }
            }

            // Process answer signals if we're the host
            if (user && isHost && latestEvent.pubkey !== user.pubkey) {
              console.log('[MultiplayerRoom] 🏠 Host checking event from guest:', latestEvent.pubkey);
              const playerSignalTag = latestEvent.tags.find(t => t[0] === 'player' && t[1] === latestEvent.pubkey)?.[2];

              if (playerSignalTag) {
                console.log('[MultiplayerRoom] 📡 Found player signal tag for guest:', latestEvent.pubkey);

                // Handle late answers (when connection timed out but answer arrives later)
                if (isWaitingForLateAnswers && !webRTCConnection) {
                  console.log('[MultiplayerRoom] 🕒 Late answer detected, recreating connection for guest:', latestEvent.pubkey);
                  handleLateAnswer(playerSignalTag, latestEvent.pubkey, latestEvent);
                  return;
                }

                if (!webRTCConnection) {
                  console.warn('[MultiplayerRoom] ⚠️ No WebRTC connection available to process guest answer');
                } else if (processedPeerSignals.has(latestEvent.pubkey)) {
                  console.log('[MultiplayerRoom] ⏭️ Already processed signal from guest:', latestEvent.pubkey);
                } else {
                  console.log('[MultiplayerRoom] 🔄 Processing answer signal from guest:', latestEvent.pubkey);
                  console.log('[MultiplayerRoom] 🔄 Host connection state:', webRTCConnection.connectionState);
                  console.log('[MultiplayerRoom] 🧊 Host ICE state:', webRTCConnection.iceConnectionState);
                  console.log('[MultiplayerRoom] 📡 Host signaling state:', webRTCConnection.signalingState);

                  // Process the answer signal through the handler with event context
                  handleRemoteSignalWithEvent(playerSignalTag, latestEvent.pubkey, latestEvent);

                  // Mark peer as processed to prevent duplicate processing
                  setProcessedPeerSignals(prev => new Set([...prev, latestEvent.pubkey]));
                }
              } else {
                console.log('[MultiplayerRoom] ❌ No player signal tag found for guest:', latestEvent.pubkey);
              }
            }
          } catch (error) {
            console.error('[MultiplayerRoom] Error parsing room event:', error);
            setRoomState(prev => ({
              ...prev,
              status: 'error',
              error: error instanceof Error ? error.message : 'Failed to parse room event'
            }));
          }
        }
      } catch (error) {
        console.error('[MultiplayerRoom] Error in room polling:', error);
      }
    };

    // Initial fetch
    pollRoomState();

    // Set up periodic polling for new events
    const interval = setInterval(pollRoomState, 3000);

    subscriptionRef.current = {
      close: () => {
        clearInterval(interval);
      }
    };

  }, [nostr, roomId, user, isHost, localSignal, fetchLatestRoomEvent, parseRoomEvent]);

  // Create WebRTC offer (host only)
  const createWebRTCOffer = useCallback(async (): Promise<string> => {
    if (!user) throw new Error('User must be logged in to create offer');

    console.log('[MultiplayerRoom] Creating WebRTC offer...');

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Add connection state logging and timeout handling
    pc.onconnectionstatechange = () => {
      console.log('[MultiplayerRoom] 🔄 Host connection state changed:', pc.connectionState);
      console.log('[MultiplayerRoom] 🧊 Host ICE state:', pc.iceConnectionState);
      console.log('[MultiplayerRoom] 📡 Host signaling state:', pc.signalingState);
      setConnectionState(pc.connectionState);

      // Handle different connection states
      if (pc.connectionState === 'connected') {
        console.log('[MultiplayerRoom] ✅ Host peer connection established successfully');
        handleConnectionEstablished();
      } else if (pc.connectionState === 'failed') {
        console.error('[MultiplayerRoom] ❌ Host peer connection failed');
        handleConnectionFailure('Peer connection failed');
      } else if (pc.connectionState === 'disconnected') {
        console.warn('[MultiplayerRoom] ⚠️ Host peer connection disconnected');
        setRoomState(prev => ({ ...prev, isWebRTCConnected: false }));
      } else if (pc.connectionState === 'closed') {
        console.log('[MultiplayerRoom] 🔒 Host peer connection closed');
        setRoomState(prev => ({ ...prev, isWebRTCConnected: false }));
      }
    };

    // Helper function to handle successful connection
    const handleConnectionEstablished = () => {
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        setConnectionTimeout(null);
      }
      if (connectionHealthCheck) {
        clearTimeout(connectionHealthCheck);
        setConnectionHealthCheck(null);
      }
      setHasConnectionTimedOut(false);
      setIsConnectionEstablished(true);

      // Set isWebRTCConnected only when the actual peer-to-peer connection is fully established
      setRoomState(prev => ({ ...prev, isWebRTCConnected: true }));
      console.log('[MultiplayerRoom] ✅ isWebRTCConnected set to true - peer-to-peer connection fully established (host)');

      // Start emulator when connection is fully established (host only)
      if (isHost && onEmulatorStart) {
        console.log('[MultiplayerRoom] WebRTC connection fully established, starting emulator on host');
        setTimeout(() => {
          onEmulatorStart();
        }, 100);
      }
    };

    // Helper function to handle connection failure
    const handleConnectionFailure = (reason: string) => {
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        setConnectionTimeout(null);
      }
      setHasConnectionTimedOut(true);
      setIsConnectionEstablished(false);
      setRoomState(prev => ({
        ...prev,
        status: 'error',
        error: `Connection failed: ${reason}`,
        isWebRTCConnected: false
      }));
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[MultiplayerRoom] 🧊 Host ICE connection state changed:', pc.iceConnectionState);
      console.log('[MultiplayerRoom] 🔄 Host connection state:', pc.connectionState);
      console.log('[MultiplayerRoom] 📡 Host signaling state:', pc.signalingState);
      setIceConnectionState(pc.iceConnectionState);

      // Handle different ICE connection states
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        console.log('[MultiplayerRoom] ✅ Host ICE connection established successfully');
        handleConnectionEstablished();
      } else if (pc.iceConnectionState === 'failed') {
        console.error('[MultiplayerRoom] ❌ Host ICE connection failed');
        handleConnectionFailure('ICE connection failed - network connectivity issues');
      } else if (pc.iceConnectionState === 'disconnected') {
        console.warn('[MultiplayerRoom] ⚠️ Host ICE connection disconnected');
        setRoomState(prev => ({ ...prev, isWebRTCConnected: false }));
      } else if (pc.iceConnectionState === 'checking') {
        console.log('[MultiplayerRoom] 🔍 Host ICE connection checking...');

        // Start health check for stuck connections
        if (connectionHealthCheck) {
          clearTimeout(connectionHealthCheck);
        }
        const healthCheck = setTimeout(() => {
          if (pc.iceConnectionState === 'checking') {
            console.warn('[MultiplayerRoom] ⚠️ Host ICE connection stuck in checking state for 20 seconds');
            console.log('[MultiplayerRoom] 💡 This might be due to network restrictions. Connection will continue to try...');
            // Don't treat as failure, just warn and continue
          }
        }, 20000); // 20 seconds before warning about stuck connection
        setConnectionHealthCheck(healthCheck);
      } else if (pc.iceConnectionState === 'new') {
        console.log('[MultiplayerRoom] 🆕 Host ICE connection initialized');
      }
    };

    // Add signaling state change tracking for debugging
    pc.onsignalingstatechange = () => {
      console.log('[MultiplayerRoom] Host signaling state changed:', pc.signalingState);
    };

    pc.onicegatheringstatechange = () => {
      console.log('[MultiplayerRoom] Host ICE gathering state changed:', pc.iceGatheringState);
    };

    // Set connection timeout (45 seconds - accommodate slow Nostr relay propagation)
    const timeout = setTimeout(() => {
      console.warn('[MultiplayerRoom] Host connection timeout after 45 seconds - enabling late answer mode');
      setHasConnectionTimedOut(true);
      setIsWaitingForLateAnswers(true);
      setRoomState(prev => ({
        ...prev,
        status: 'waiting_for_player', // More specific status for UI feedback
        error: 'Waiting for other player... They can still join and connect.'
      }));
    }, 45000);
    setConnectionTimeout(timeout);

    // Create data channels for different purposes
    const gameDataChannel = pc.createDataChannel('game-data');
    const chatDataChannel = pc.createDataChannel('chat');

    // Handle game data channel
    gameDataChannel.onopen = () => {
      console.log('[MultiplayerRoom] Game data channel opened');
    };

    gameDataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[MultiplayerRoom] Received game input:', data);
        // Handle game input messages from peers (arrow keys, buttons, etc.)
        // This will be forwarded to the emulator
      } catch (error) {
        console.error('[MultiplayerRoom] Error parsing game data message:', error);
      }
    };

    // Handle chat data channel
    chatDataChannel.onopen = () => {
      console.log('[MultiplayerRoom] 📡 Host chat data channel opened');
      console.log('[MultiplayerRoom] 🔄 Host connection state:', pc.connectionState);
      console.log('[MultiplayerRoom] 🧊 Host ICE state:', pc.iceConnectionState);
      console.log('[MultiplayerRoom] 📡 Host signaling state:', pc.signalingState);
      setDataChannel(chatDataChannel);

      // Note: isWebRTCConnected will be set in connection state handlers when connection is fully established
      console.log('[MultiplayerRoom] ⏳ Host waiting for peer-to-peer connection to be fully established...');
    };

    chatDataChannel.onclose = () => {
      console.log('[MultiplayerRoom] 📡 Host chat data channel closed');
      setDataChannel(null);
    };

    chatDataChannel.onerror = (error) => {
      console.error('[MultiplayerRoom] ❌ Host chat data channel error:', error);
    };

    chatDataChannel.onmessage = (event) => {
      try {
        const chatMessage: ChatMessage = JSON.parse(event.data);
        console.log('[MultiplayerRoom] Received chat message:', chatMessage);

        setRoomState(prev => ({
          ...prev,
          chatMessages: [...(prev.chatMessages || []), chatMessage]
        }));
      } catch (error) {
        console.error('[MultiplayerRoom] Error parsing chat message:', error);
      }
    };

    setWebRTCConnection(pc);

    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait for ICE candidates to be gathered
    await new Promise<void>((resolve) => {
      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          setTimeout(checkState, 100);
        }
      };
      checkState();
    });

    const offerJson = JSON.stringify(pc.localDescription);
    setLocalSignal(offerJson);

    console.log('[MultiplayerRoom] WebRTC offer created');
    return offerJson;
  }, [user]);

  // Helper function to handle successful connection
  const handleConnectionEstablished = useCallback(() => {
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
      setConnectionTimeout(null);
    }
    if (connectionHealthCheck) {
      clearTimeout(connectionHealthCheck);
      setConnectionHealthCheck(null);
    }
    setHasConnectionTimedOut(false);
    setIsConnectionEstablished(true);
    setIsWaitingForLateAnswers(false);

    // Set isWebRTCConnected only when actual peer-to-peer connection is fully established
    setRoomState(prev => ({ ...prev, isWebRTCConnected: true, status: 'active' }));
    console.log('[MultiplayerRoom] ✅ isWebRTCConnected set to true - peer-to-peer connection fully established (host)');

    // Start emulator when connection is fully established (host only)
    if (isHost && onEmulatorStart) {
      console.log('[MultiplayerRoom] 🎮 WebRTC connection fully established, starting emulator on host');
      setTimeout(() => {
        onEmulatorStart();
      }, 100);
    }
  }, [connectionTimeout, connectionHealthCheck, isHost, onEmulatorStart]);

  // Helper function to handle connection failure
  const handleConnectionFailure = useCallback((reason: string) => {
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
      setConnectionTimeout(null);
    }
    if (connectionHealthCheck) {
      clearTimeout(connectionHealthCheck);
      setConnectionHealthCheck(null);
    }
    setHasConnectionTimedOut(true);
    setIsConnectionEstablished(false);
    setIsWaitingForLateAnswers(false);
    setRoomState(prev => ({
      ...prev,
      status: 'error',
      error: `Connection failed: ${reason}`,
      isWebRTCConnected: false
    }));
  }, [connectionTimeout, connectionHealthCheck]);

  // Helper function to handle successful guest connection
  const handleGuestConnectionEstablished = useCallback(() => {
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
      setConnectionTimeout(null);
    }
    if (connectionHealthCheck) {
      clearTimeout(connectionHealthCheck);
      setConnectionHealthCheck(null);
    }
    setHasConnectionTimedOut(false);
    setIsConnectionEstablished(true);
    setIsWaitingForLateAnswers(false);

    // Set isWebRTCConnected only when actual peer-to-peer connection is fully established
    setRoomState(prev => ({
      ...prev,
      isWebRTCConnected: true,
      canJoinGame: false // Disable join game button once connected
    }));
    console.log('[MultiplayerRoom] ✅ isWebRTCConnected set to true - peer-to-peer connection fully established (guest)');
  }, [connectionTimeout, connectionHealthCheck]);

  // Helper function to handle guest connection failure
  const handleGuestConnectionFailure = useCallback((reason: string) => {
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
      setConnectionTimeout(null);
    }
    if (connectionHealthCheck) {
      clearTimeout(connectionHealthCheck);
      setConnectionHealthCheck(null);
    }
    setHasConnectionTimedOut(true);
    setIsConnectionEstablished(false);
    setIsWaitingForLateAnswers(false);
    setRoomState(prev => ({
      ...prev,
      status: 'error',
      error: `Connection failed: ${reason}`,
      isWebRTCConnected: false,
      canJoinGame: true // Re-enable join game button for retry
    }));
  }, [connectionTimeout, connectionHealthCheck]);

  // Handle remote signal (answer from peer)
  const handleRemoteSignal = useCallback(async (signal: string, fromPubkey: string) => {
    // Skip processing if the sender is the current user
    if (user && fromPubkey === user.pubkey) {
      console.log('[MultiplayerRoom] Skipping processing of own signal');
      return;
    }

    if (!webRTCConnection) {
      console.warn('[MultiplayerRoom] No WebRTC connection available for signal handling');
      return;
    }

    try {
      console.log('[MultiplayerRoom] Handling remote signal from:', fromPubkey);
      console.log('[MultiplayerRoom] Signal data preview:', signal.substring(0, 100) + '...');
      console.log('[MultiplayerRoom] Current connection signaling state:', webRTCConnection.signalingState);

      const signalData = JSON.parse(signal);
      console.log('[MultiplayerRoom] Parsed signal type:', signalData.type);

      if (signalData.type === 'answer') {
        console.log('[MultiplayerRoom] Processing answer signal (host side)');
        console.log('[MultiplayerRoom] Host connection signaling state:', webRTCConnection.signalingState);

        // Check if we can safely set remote description
        // For answer processing, we expect to be in 'have-local-offer' state
        if (webRTCConnection.signalingState === 'closed') {
          console.warn('[MultiplayerRoom] Cannot set remote answer - connection closed');
          return;
        }

        // Check if already processed this answer
        if (webRTCConnection.signalingState === 'stable') {
          console.log('[MultiplayerRoom] Connection already stable, answer already processed');
          return;
        }

        // Only accept answers when we have a local offer (the correct state)
        if (webRTCConnection.signalingState !== 'have-local-offer') {
          console.warn('[MultiplayerRoom] Cannot set remote answer - expected have-local-offer state, got:', webRTCConnection.signalingState);
          return;
        }

        console.log('[MultiplayerRoom] Setting remote description for answer');
        await webRTCConnection.setRemoteDescription(signalData);
        console.log('[MultiplayerRoom] Remote description set successfully, new state:', webRTCConnection.signalingState);

        // Only publish status update if this is a new player connection and the player count actually changed
        const isPlayerAlreadyConnected = roomState.connectedPlayers.some(p => p.pubkey === fromPubkey);
        const newPlayerCount = roomState.connectedPlayers.length + 1;

        if (!isPlayerAlreadyConnected && newPlayerCount !== roomState.connectedPlayers.length) {
          // Ensure host tag is present and valid before publishing - fallback to current user if missing
          const hostTag = roomState.hostPubkey || user?.pubkey;

          if (!hostTag || !roomState.requiredPlayers) {
            console.error('[MultiplayerRoom] Cannot publish event: missing required host info', {
              hostTag,
              roomStateHostPubkey: roomState.hostPubkey,
              userPubkey: user?.pubkey,
              requiredPlayers: roomState.requiredPlayers
            });
            return;
          }

          // Prevent publishing events if connection is already established
          if (isConnectionEstablished) {
            console.log('[MultiplayerRoom] Skipping event publication - connection already established');
            return;
          }

          // Update room state to active when connection is established
          if (newPlayerCount >= roomState.requiredPlayers) {
            await publishEvent({
              kind: 31997,
              content: '',
              tags: [
                ['d', roomId],
                ['game', gameId],
                ['players', roomState.requiredPlayers.toString()],
                ['host', hostTag], // Use fallback host tag
                ['status', 'full'],
                ['connected_count', newPlayerCount.toString()]
              ]
            });
          } else {
            await publishEvent({
              kind: 31997,
              content: '',
              tags: [
                ['d', roomId],
                ['game', gameId],
                ['players', roomState.requiredPlayers.toString()],
                ['host', hostTag], // Use fallback host tag
                ['status', 'active'],
                ['connected_count', newPlayerCount.toString()]
              ]
            });
          }
        }
      } else {
        console.warn('[MultiplayerRoom] Unknown signal type:', signalData.type);
      }
    } catch (error) {
      console.error('[MultiplayerRoom] Error handling remote signal:', error);
    }
  }, [webRTCConnection, roomId, gameId, roomState.requiredPlayers, roomState.hostPubkey, roomState.connectedPlayers, user, publishEvent]);

  // Join or create room
  const joinOrCreateRoom = useCallback(async () => {
    if (!user || !roomId || !gameId) {
      throw new Error('Missing required parameters');
    }

    console.log('[MultiplayerRoom] Joining or creating room:', { roomId, gameId });

    // Check if room already exists
    const existingEvents = await nostr?.query([{
      kinds: [31997],
      '#d': [roomId],
      limit: 1
    }], { signal: AbortSignal.timeout(5000) });

    if (existingEvents && existingEvents.length > 0) {
      // Room exists, check if we're the host or joining as player
      console.log('[MultiplayerRoom] Room exists, checking role...');
      const roomEvent = existingEvents[0];
      const roomData = parseRoomEvent(roomEvent, roomState.hostPubkey);

      const shareableLink = `${window.location.origin}/multiplayer/${gameId}/${roomId}`;

      // Check if current user is the host
      if (roomData.hostPubkey === user.pubkey) {
        console.log('[MultiplayerRoom] Current user is the host of existing room');
        setIsHost(true);
        setRoomState(prev => ({
          ...roomData,
          shareableLink,
          // Preserve existing state properties
          isWebRTCConnected: prev.isWebRTCConnected,
          chatMessages: prev.chatMessages,
          pendingHostSignal: prev.pendingHostSignal,
          canJoinGame: prev.canJoinGame,
          error: prev.error,
        }));
      } else {
        // Joining as a guest player
        console.log('[MultiplayerRoom] Joining as guest player');

        if (roomData.connectedPlayers.length >= roomData.requiredPlayers) {
          throw new Error('Room is full');
        }

        setIsHost(false);
        setRoomState(prev => ({
          ...roomData,
          shareableLink,
          // Preserve existing state properties
          isWebRTCConnected: prev.isWebRTCConnected,
          chatMessages: prev.chatMessages,
          pendingHostSignal: prev.pendingHostSignal,
          canJoinGame: prev.canJoinGame,
          error: prev.error,
        }));

        // Wait for host signal and respond with answer
        // This will be handled in the subscription when we receive the offer
      }
    } else {
      // Create new room as host - check if already published
      if (alreadyPublishedRef.current) {
        console.log('[MultiplayerRoom] Room already published, skipping creation');
        return;
      }

      console.log('[MultiplayerRoom] Creating new room as host');

      // First, get game metadata to determine number of players
      const gameEvents = await nostr?.query([{
        kinds: [31996],
        '#d': [gameId],
        limit: 1
      }], { signal: AbortSignal.timeout(5000) });

      let playerCount = 2; // Default
      if (gameEvents && gameEvents.length > 0) {
        const gameEvent = gameEvents[0];
        const playersTag = gameEvent.tags.find(t => t[0] === 'players')?.[1];
        if (playersTag) {
          const parsed = parseInt(playersTag, 10);
          if (!isNaN(parsed) && parsed > 0) {
            playerCount = parsed;
          }
        }
      }

      const offer = await createWebRTCOffer();
      setIsHost(true);

      // Generate shareable link
      const shareableLink = `${window.location.origin}/multiplayer/${gameId}/${roomId}`;

      // Mark as published before publishing to prevent race conditions
      alreadyPublishedRef.current = true;

      await publishEvent({
        kind: 31997,
        content: '',
        tags: [
          ['d', roomId],
          ['game', gameId],
          ['players', playerCount.toString()],
          ['host', user.pubkey],
          ['status', 'waiting'],
          ['signal', offer]
        ]
      });

      // Update state with shareable link and include host as connected player
      setRoomState(prev => ({
        ...prev,
        requiredPlayers: playerCount,
        hostPubkey: user.pubkey,
        shareableLink,
        connectedPlayers: [{
          pubkey: user.pubkey,
          signal: offer
        }],
        status: 'waiting',
        // Preserve existing state properties
        isWebRTCConnected: prev.isWebRTCConnected,
        chatMessages: prev.chatMessages,
        pendingHostSignal: prev.pendingHostSignal,
        canJoinGame: prev.canJoinGame,
        error: prev.error,
      }));

      console.log('[MultiplayerRoom] Room created successfully');
    }
  }, [user, roomId, gameId, nostr, parseRoomEvent, createWebRTCOffer, publishEvent]);

  // Start game when all players are ready (host only)
  const startGame = useCallback(async () => {
    if (!user || !isHost) {
      throw new Error('Only host can start the game');
    }

    if (roomState.status !== 'full' && roomState.connectedPlayers.length < roomState.requiredPlayers) {
      throw new Error('Cannot start game: not all players connected');
    }

    console.log('[MultiplayerRoom] Starting game...');

    // Update room status to full/game active
    await publishEvent({
      kind: 31997,
      content: '',
      tags: [
        ['d', roomId],
        ['game', gameId],
        ['players', roomState.requiredPlayers.toString()],
        ['host', roomState.hostPubkey],
        ['status', 'playing']
      ]
    });

    setRoomState(prev => ({ ...prev, status: 'playing' }));
  }, [user, isHost, roomState, roomId, gameId, publishEvent]);

  // Send game input to host (for non-host players)
  const sendGameInput = useCallback((input: any) => {
    if (webRTCConnection && !isHost) {
      // Find data channel - this is a simplified approach
      // In a real implementation, you'd track data channels more explicitly
      webRTCConnection.getSenders().forEach(sender => {
        if (sender.track && sender.track.kind === 'datachannel') {
          // This is a placeholder - actual data channel handling would be more complex
          console.log('[MultiplayerRoom] Sending input via WebRTC:', input);
        }
      });
    }
  }, [webRTCConnection, isHost, user]);

  // Send game state to players (for host)
  const sendGameState = useCallback((state: any) => {
    if (webRTCConnection && isHost) {
      // Find data channel - this is a simplified approach
      webRTCConnection.getSenders().forEach(sender => {
        if (sender.track && sender.track.kind === 'datachannel') {
          // This is a placeholder - actual data channel handling would be more complex
          console.log('[MultiplayerRoom] Sending game state via WebRTC:', state);
        }
      });
    }
  }, [webRTCConnection, isHost]);

  // Send chat message via WebRTC data channel
  const sendChatMessage = useCallback((message: string) => {
    if (!dataChannel || !user) return;

    const chatMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: user.pubkey,
      message,
      timestamp: Date.now(),
    };

    try {
      dataChannel.send(JSON.stringify(chatMessage));

      // Add to local state immediately
      setRoomState(prev => ({
        ...prev,
        chatMessages: [...(prev.chatMessages || []), chatMessage]
      }));

      console.log('[MultiplayerRoom] Chat message sent:', chatMessage);
    } catch (error) {
      console.error('[MultiplayerRoom] Error sending chat message:', error);
    }
  }, [dataChannel, user]);

  // Set callback for emulator start (host only)
  const setEmulatorStartCallback = useCallback((callback: () => void) => {
    setOnEmulatorStart(() => callback);
  }, []);

  // Join game (guest only) - manually process the host's signal
  const joinGame = useCallback(async () => {
    if (!user || isHost || !roomState.pendingHostSignal) {
      console.error('[MultiplayerRoom] Cannot join game: invalid state');
      return;
    }

    // Prevent multiple join attempts
    if (isJoining || isConnectionEstablished) {
      console.log('[MultiplayerRoom] Already joining or connection established, skipping duplicate attempt');
      return;
    }

    setIsJoining(true);
    console.log('[MultiplayerRoom] Guest joining game with host signal');

    try {
      // Create new peer connection for guest
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Add connection state logging and timeout handling
      pc.onconnectionstatechange = () => {
        console.log('[MultiplayerRoom] 🔄 Guest connection state changed:', pc.connectionState);
        console.log('[MultiplayerRoom] 🧊 Guest ICE state:', pc.iceConnectionState);
        console.log('[MultiplayerRoom] 📡 Guest signaling state:', pc.signalingState);
        setConnectionState(pc.connectionState);

        // Handle different connection states
        if (pc.connectionState === 'connected') {
          console.log('[MultiplayerRoom] ✅ Guest peer connection established successfully');
          handleGuestConnectionEstablished();
        } else if (pc.connectionState === 'failed') {
          console.error('[MultiplayerRoom] ❌ Guest peer connection failed');
          handleGuestConnectionFailure('Peer connection failed');
        } else if (pc.connectionState === 'disconnected') {
          console.warn('[MultiplayerRoom] ⚠️ Guest peer connection disconnected');
          setRoomState(prev => ({ ...prev, isWebRTCConnected: false }));
        } else if (pc.connectionState === 'closed') {
          console.log('[MultiplayerRoom] 🔒 Guest peer connection closed');
          setRoomState(prev => ({ ...prev, isWebRTCConnected: false }));
        }
      };

      // Helper function to handle successful guest connection
      const handleGuestConnectionEstablished = () => {
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
          setConnectionTimeout(null);
        }
        if (connectionHealthCheck) {
          clearTimeout(connectionHealthCheck);
          setConnectionHealthCheck(null);
        }
        setHasConnectionTimedOut(false);
        setIsConnectionEstablished(true);

        // Set isWebRTCConnected only when the actual peer-to-peer connection is fully established
        setRoomState(prev => ({
          ...prev,
          isWebRTCConnected: true,
          canJoinGame: false // Disable join game button once connected
        }));
        console.log('[MultiplayerRoom] ✅ isWebRTCConnected set to true - peer-to-peer connection fully established (guest)');
      };

      // Helper function to handle guest connection failure
      const handleGuestConnectionFailure = (reason: string) => {
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
          setConnectionTimeout(null);
        }
        setHasConnectionTimedOut(true);
        setIsConnectionEstablished(false);
        setRoomState(prev => ({
          ...prev,
          status: 'error',
          error: `Connection failed: ${reason}`,
          isWebRTCConnected: false,
          canJoinGame: true // Re-enable join game button for retry
        }));
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[MultiplayerRoom] 🧊 Guest ICE connection state changed:', pc.iceConnectionState);
        console.log('[MultiplayerRoom] 🔄 Guest connection state:', pc.connectionState);
        console.log('[MultiplayerRoom] 📡 Guest signaling state:', pc.signalingState);
        setIceConnectionState(pc.iceConnectionState);

        // Handle different ICE connection states
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          console.log('[MultiplayerRoom] ✅ Guest ICE connection established successfully');
          handleGuestConnectionEstablished();
        } else if (pc.iceConnectionState === 'failed') {
          console.error('[MultiplayerRoom] ❌ Guest ICE connection failed');
          handleGuestConnectionFailure('ICE connection failed - network connectivity issues');
        } else if (pc.iceConnectionState === 'disconnected') {
          console.warn('[MultiplayerRoom] ⚠️ Guest ICE connection disconnected');
          setRoomState(prev => ({ ...prev, isWebRTCConnected: false }));
        } else if (pc.iceConnectionState === 'checking') {
          console.log('[MultiplayerRoom] 🔍 Guest ICE connection checking...');

          // Start health check for stuck connections
          if (connectionHealthCheck) {
            clearTimeout(connectionHealthCheck);
          }
          const healthCheck = setTimeout(() => {
            if (pc.iceConnectionState === 'checking') {
              console.warn('[MultiplayerRoom] ⚠️ Guest ICE connection stuck in checking state for 20 seconds');
              console.log('[MultiplayerRoom] 💡 This might be due to network restrictions. Connection will continue to try...');
              // Don't treat as failure, just warn and continue
            }
          }, 20000); // 20 seconds before warning about stuck connection
          setConnectionHealthCheck(healthCheck);
        } else if (pc.iceConnectionState === 'new') {
          console.log('[MultiplayerRoom] 🆕 Guest ICE connection initialized');
        }
      };

      // Add signaling state change tracking for debugging
      pc.onsignalingstatechange = () => {
        console.log('[MultiplayerRoom] Guest signaling state changed:', pc.signalingState);
      };

      pc.onicegatheringstatechange = () => {
        console.log('[MultiplayerRoom] Guest ICE gathering state changed:', pc.iceGatheringState);
      };

      // Set connection timeout (45 seconds - accommodate slow Nostr relay propagation)
      const timeout = setTimeout(() => {
        console.warn('[MultiplayerRoom] Guest connection timeout after 45 seconds');
        setHasConnectionTimedOut(true);
        setRoomState(prev => ({
          ...prev,
          status: 'waiting_to_retry', // Specific status for UI feedback
          error: 'Connection taking longer than expected. Please try joining again.'
        }));
      }, 45000);
      setConnectionTimeout(timeout);

      // Handle incoming data channels from host
      pc.ondatachannel = (event) => {
        const receivedChannel = event.channel;
        console.log('[MultiplayerRoom] Received data channel (guest):', receivedChannel.label);

        if (receivedChannel.label === 'chat') {
          receivedChannel.onopen = () => {
            console.log('[MultiplayerRoom] 📡 Guest chat data channel opened');
            console.log('[MultiplayerRoom] 🔄 Guest connection state:', pc.connectionState);
            console.log('[MultiplayerRoom] 🧊 Guest ICE state:', pc.iceConnectionState);
            console.log('[MultiplayerRoom] 📡 Guest signaling state:', pc.signalingState);
            setDataChannel(receivedChannel);

            // Note: isWebRTCConnected will be set in connection state handlers when connection is fully established
            console.log('[MultiplayerRoom] ⏳ Guest waiting for peer-to-peer connection to be fully established...');
          };

          receivedChannel.onclose = () => {
            console.log('[MultiplayerRoom] 📡 Guest chat data channel closed');
            setDataChannel(null);
          };

          receivedChannel.onerror = (error) => {
            console.error('[MultiplayerRoom] ❌ Guest chat data channel error:', error);
          };

          receivedChannel.onmessage = (event) => {
            try {
              const chatMessage: ChatMessage = JSON.parse(event.data);
              console.log('[MultiplayerRoom] Received chat message (guest):', chatMessage);

              setRoomState(prev => ({
                ...prev,
                chatMessages: [...(prev.chatMessages || []), chatMessage]
              }));
            } catch (error) {
              console.error('[MultiplayerRoom] Error parsing chat message (guest):', error);
            }
          };
        } else if (receivedChannel.label === 'game-data') {
          receivedChannel.onopen = () => {
            console.log('[MultiplayerRoom] Game data channel opened (guest)');
          };

          receivedChannel.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              console.log('[MultiplayerRoom] Received game state (guest):', data);
              // Handle game state updates from host
            } catch (error) {
              console.error('[MultiplayerRoom] Error parsing game data message (guest):', error);
            }
          };
        }
      };

      // Process the host's offer
      const hostOffer = JSON.parse(roomState.pendingHostSignal);
      console.log('[MultiplayerRoom] Setting remote description from host offer');
      console.log('[MultiplayerRoom] Guest connection signaling state:', pc.signalingState);

      // Check if connection can accept remote description
      // Note: 'stable' state is actually the correct state for setting a remote offer
      // It means the connection is ready and hasn't started negotiating yet
      if (pc.signalingState === 'closed') {
        console.warn('[MultiplayerRoom] Cannot set remote offer - connection closed');
        throw new Error('Connection is closed');
      }

      // Check for have-remote-offer state (already processed)
      if (pc.signalingState === 'have-remote-offer') {
        console.warn('[MultiplayerRoom] Cannot set remote offer - already have remote offer');
        throw new Error('Remote offer already processed');
      }

      // Check for have-local-offer state (already created answer)
      if (pc.signalingState === 'have-local-offer') {
        console.warn('[MultiplayerRoom] Cannot set remote offer - already have local offer');
        throw new Error('Local offer already created');
      }

      // 'stable' is actually the correct state for setting remote offer
      // 'new' is also acceptable
      const validStates = ['stable', 'new'] as const;
      if (!validStates.includes(pc.signalingState as any)) {
        console.warn('[MultiplayerRoom] Cannot set remote offer - connection in unexpected state:', pc.signalingState);
        throw new Error(`Connection in unexpected state: ${pc.signalingState}`);
      }

      await pc.setRemoteDescription(hostOffer);
      console.log('[MultiplayerRoom] Remote description set, new state:', pc.signalingState);

      // Create answer
      console.log('[MultiplayerRoom] Creating answer for host');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        const checkState = () => {
          if (pc.iceGatheringState === 'complete') {
            console.log('[MultiplayerRoom] ICE gathering complete for guest');
            resolve();
          } else {
            setTimeout(checkState, 100);
          }
        };
        checkState();
      });

      setWebRTCConnection(pc);
      const answerJson = JSON.stringify(pc.localDescription);
      setLocalSignal(answerJson);

      // Validate required fields before publishing - fallback to current user if hostPubkey is missing
      const hostTag = roomState.hostPubkey || user?.pubkey;

      if (!hostTag || !roomState.requiredPlayers || !roomId || !gameId) {
        console.error('[MultiplayerRoom] Cannot publish answer event: missing required fields', {
          hostPubkey: roomState.hostPubkey,
          fallbackHostTag: hostTag,
          userPubkey: user?.pubkey,
          requiredPlayers: roomState.requiredPlayers,
          roomId,
          gameId
        });
        throw new Error('Missing required fields for room event');
      }

      // Prevent publishing events if connection is already established
      if (isConnectionEstablished) {
        console.log('[MultiplayerRoom] Skipping answer publication - connection already established');
        return;
      }

      // Guard against duplicate publication
      const isAlreadyConnected = roomState.connectedPlayers.some(p => p.pubkey === user.pubkey);
      if (isAlreadyConnected) {
        console.log('[MultiplayerRoom] Player already connected, skipping duplicate publication');
        return;
      }

      // Publish answer as new room event
      console.log('[MultiplayerRoom] Publishing answer signal to Nostr');
      await publishEvent({
        kind: 31997,
        content: '',
        tags: [
          ['d', roomId],
          ['game', gameId],
          ['players', roomState.requiredPlayers.toString()],
          ['host', hostTag], // Use fallback host tag
          ['status', 'active'],
          ['connected', user.pubkey],
          ['player', user.pubkey, answerJson],
          ['connected_count', (roomState.connectedPlayers.length + 1).toString()]
        ]
      });

      console.log('[MultiplayerRoom] Join game process completed successfully');
    } catch (error) {
      console.error('[MultiplayerRoom] Error joining game:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to join game';

      // Provide more specific error messages for common issues
      let userFriendlyError = errorMessage;
      if (errorMessage.includes('Connection already established')) {
        userFriendlyError = 'Connection already established. The game should start shortly.';
      } else if (errorMessage.includes('stable')) {
        userFriendlyError = 'Connection negotiation in progress. Please wait...';
      } else if (errorMessage.includes('closed')) {
        userFriendlyError = 'Connection closed. Please try again.';
      }

      setRoomState(prev => ({
        ...prev,
        status: 'error',
        error: userFriendlyError
      }));
    } finally {
      setIsJoining(false);
    }
  }, [user, isHost, roomState.pendingHostSignal, roomState.requiredPlayers, roomState.hostPubkey, roomState.connectedPlayers.length, roomId, gameId, publishEvent]);

  // Handle remote signal with event context (for accessing event.tags)
  const handleRemoteSignalWithEvent = useCallback(async (signal: string, fromPubkey: string, event: NostrEvent) => {
    // Skip processing if the sender is the current user
    if (user && fromPubkey === user.pubkey) {
      console.log('[MultiplayerRoom] Skipping processing of own signal');
      return;
    }

    if (!webRTCConnection) {
      console.warn('[MultiplayerRoom] No WebRTC connection available for signal handling');
      return;
    }

    try {
      console.log('[MultiplayerRoom] Handling remote signal from:', fromPubkey);
      console.log('[MultiplayerRoom] Signal data preview:', signal.substring(0, 100) + '...');
      console.log('[MultiplayerRoom] Current connection signaling state:', webRTCConnection.signalingState);

      const signalData = JSON.parse(signal);
      console.log('[MultiplayerRoom] Parsed signal type:', signalData.type);

      if (signalData.type === 'answer') {
        console.log('[MultiplayerRoom] Processing answer signal (host side)');
        console.log('[MultiplayerRoom] Host connection signaling state:', webRTCConnection.signalingState);

        // Check if we can safely set remote description
        // For answer processing, we expect to be in 'have-local-offer' state
        if (webRTCConnection.signalingState === 'closed') {
          console.warn('[MultiplayerRoom] Cannot set remote answer - connection closed');
          return;
        }

        // Check if already processed this answer
        if (webRTCConnection.signalingState === 'stable') {
          console.log('[MultiplayerRoom] Connection already stable, answer already processed');
          return;
        }

        // Only accept answers when we have a local offer (the correct state)
        if (webRTCConnection.signalingState !== 'have-local-offer') {
          console.warn('[MultiplayerRoom] Cannot set remote answer - expected have-local-offer state, got:', webRTCConnection.signalingState);
          return;
        }

        console.log('[MultiplayerRoom] Setting remote description for answer');
        await webRTCConnection.setRemoteDescription(signalData);
        console.log('[MultiplayerRoom] Remote description set successfully, new state:', webRTCConnection.signalingState);

        // Only publish status update if this is a new player connection and the player count actually changed
        const isPlayerAlreadyConnected = roomState.connectedPlayers.some(p => p.pubkey === fromPubkey);
        const newPlayerCount = roomState.connectedPlayers.length + 1;

        if (!isPlayerAlreadyConnected && newPlayerCount !== roomState.connectedPlayers.length) {
          // Ensure host tag is present and valid before publishing - fallback to current user if missing
          const hostTag = roomState.hostPubkey || user?.pubkey;

          if (!hostTag || !roomState.requiredPlayers) {
            console.error('[MultiplayerRoom] Cannot publish event: missing required host info', {
              hostTag,
              roomStateHostPubkey: roomState.hostPubkey,
              userPubkey: user?.pubkey,
              requiredPlayers: roomState.requiredPlayers
            });
            return;
          }

          // Prevent publishing events if connection is already established
          if (isConnectionEstablished) {
            console.log('[MultiplayerRoom] Skipping event publication - connection already established');
            return;
          }

          // Update room state to active when connection is established
          if (newPlayerCount >= roomState.requiredPlayers) {
            await publishEvent({
              kind: 31997,
              content: '',
              tags: [
                ['d', roomId],
                ['game', gameId],
                ['players', roomState.requiredPlayers.toString()],
                ['host', hostTag], // Use fallback host tag
                ['status', 'full'],
                ['connected_count', newPlayerCount.toString()]
              ]
            });
          } else {
            await publishEvent({
              kind: 31997,
              content: '',
              tags: [
                ['d', roomId],
                ['game', gameId],
                ['players', roomState.requiredPlayers.toString()],
                ['host', hostTag], // Use fallback host tag
                ['status', 'active'],
                ['connected_count', newPlayerCount.toString()]
              ]
            });
          }
        }
      } else {
        console.warn('[MultiplayerRoom] Unknown signal type:', signalData.type);
      }
    } catch (error) {
      console.error('[MultiplayerRoom] Error handling remote signal:', error);
    }
  }, [webRTCConnection, roomId, gameId, roomState.requiredPlayers, roomState.hostPubkey, roomState.connectedPlayers, user, publishEvent, isConnectionEstablished]);

  // Retry connection after timeout or failure
  const retryConnection = useCallback(() => {
    console.log('[MultiplayerRoom] 🔄 Retrying WebRTC connection...');

    // Clear timeout state
    setHasConnectionTimedOut(false);
    setConnectionState('new');
    setIceConnectionState('new');
    setIsConnectionEstablished(false);

    // Close existing connection if any
    if (webRTCConnection) {
      console.log('[MultiplayerRoom] 🔒 Closing existing WebRTC connection for retry');
      webRTCConnection.close();
      setWebRTCConnection(null);
    }

    // Clear data channel
    setDataChannel(null);
    setLocalSignal(null);

    // Clear connection timeout if any
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
      setConnectionTimeout(null);
    }

    // Reset room state but preserve important properties
    setRoomState(prev => ({
      ...prev,
      status: 'waiting',
      error: undefined,
      isWebRTCConnected: false,
      hostPubkey: prev.hostPubkey, // Ensure hostPubkey is preserved
      shareableLink: prev.shareableLink, // Preserve shareable link
      connectedPlayers: prev.connectedPlayers, // Preserve connected players from Nostr
      chatMessages: prev.chatMessages, // Preserve chat messages
    }));

    // Reset processed events to allow reprocessing
    setProcessedEvents(new Set());
    setProcessedPeerSignals(new Set());

    // Retry based on role
    if (isHost) {
      console.log('[MultiplayerRoom] 🏠 Host retrying - will recreate offer');
      // Host should recreate the room/offer
      setTimeout(() => {
        joinOrCreateRoom();
      }, 1000);
    } else if (roomState.pendingHostSignal) {
      console.log('[MultiplayerRoom] 👤 Guest retrying - will rejoin with existing host signal');
      // Guest should retry joining with existing signal
      setTimeout(() => {
        joinGame();
      }, 1000);
    } else {
      console.log('[MultiplayerRoom] ⏳ Waiting for host signal to retry');
      // Reset to allow new join attempt
      setRoomState(prev => ({
        ...prev,
        canJoinGame: true
      }));
    }
  }, [webRTCConnection, isHost, roomState.pendingHostSignal, roomState.hostPubkey, roomState.shareableLink, roomState.connectedPlayers, roomState.chatMessages, connectionTimeout, joinGame, joinOrCreateRoom]);

  // Handle late answers (when host connection timed out but answer arrives later)
  const handleLateAnswer = useCallback(async (signal: string, fromPubkey: string, event: NostrEvent) => {
    if (!user) return;

    console.log('[MultiplayerRoom] 🕒 Handling late answer from guest:', fromPubkey);

    // Reset timeout state
    setHasConnectionTimedOut(false);
    setIsWaitingForLateAnswers(false);

    // Create new peer connection for late answer
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ],
      iceCandidatePoolSize: 10
    });

    // Set up connection handlers (similar to createWebRTCOffer)
    pc.onconnectionstatechange = () => {
      console.log('[MultiplayerRoom] 🔄 Late answer connection state changed:', pc.connectionState);
      console.log('[MultiplayerRoom] 🧊 Late answer ICE state:', pc.iceConnectionState);
      console.log('[MultiplayerRoom] 📡 Late answer signaling state:', pc.signalingState);

      if (pc.connectionState === 'connected') {
        console.log('[MultiplayerRoom] ✅ Late answer connection established successfully');
        handleConnectionEstablished();
      } else if (pc.connectionState === 'failed') {
        console.error('[MultiplayerRoom] ❌ Late answer connection failed');
        handleConnectionFailure('Late answer connection failed');
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[MultiplayerRoom] 🧊 Late answer ICE connection state changed:', pc.iceConnectionState);

      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        console.log('[MultiplayerRoom] ✅ Late answer ICE connection established successfully');
        handleConnectionEstablished();
      } else if (pc.iceConnectionState === 'failed') {
        console.error('[MultiplayerRoom] ❌ Late answer ICE connection failed');
        handleConnectionFailure('Late answer ICE connection failed');
      }
    };

    // Create data channels
    const gameDataChannel = pc.createDataChannel('game-data');
    const chatDataChannel = pc.createDataChannel('chat');

    chatDataChannel.onopen = () => {
      console.log('[MultiplayerRoom] 📡 Late answer chat data channel opened');
      setDataChannel(chatDataChannel);
    };

    chatDataChannel.onclose = () => {
      console.log('[MultiplayerRoom] 📡 Late answer chat data channel closed');
      setDataChannel(null);
    };

    chatDataChannel.onerror = (error) => {
      console.error('[MultiplayerRoom] ❌ Late answer chat data channel error:', error);
    };

    // Set up ICE candidate handling
    const localIceCandidates: RTCIceCandidate[] = [];
    pc.onicecandidate = (event) => {
      console.log('[MultiplayerRoom] Late answer ICE candidate generated:', event.candidate ? event.candidate.candidate : 'null (complete)');

      if (event.candidate) {
        localIceCandidates.push(event.candidate);
      } else {
        console.log('[MultiplayerRoom] Late answer ICE gathering complete with', localIceCandidates.length, 'candidates');
        (pc as any).localIceCandidates = localIceCandidates;
      }
    };

    setWebRTCConnection(pc);

    // Process late answer
    try {
      const signalData = JSON.parse(signal);
      console.log('[MultiplayerRoom] Late answer signal type:', signalData.type);

      // Set remote description with late answer
      await pc.setRemoteDescription(signalData);
      console.log('[MultiplayerRoom] Late answer remote description set');

      // Add ICE candidates from late answer
      if (signalData.iceCandidates && Array.isArray(signalData.iceCandidates)) {
        console.log('[MultiplayerRoom] Adding', signalData.iceCandidates.length, 'late answer ICE candidates');
        for (const candidate of signalData.iceCandidates) {
          try {
            await pc.addIceCandidate(candidate);
            console.log('[MultiplayerRoom] ✅ Added late answer ICE candidate:', candidate.candidate?.substring(0, 50) + '...');
          } catch (error) {
            console.warn('[MultiplayerRoom] Failed to add late answer ICE candidate:', error);
          }
        }
      }

      // Create new offer for late connection
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          const checkState = () => {
            if (pc.iceGatheringState === 'complete') {
              resolve();
            } else {
              setTimeout(checkState, 100);
            }
          };
          checkState();
        }
      });

      // Create enhanced offer with ICE candidates
      const offerWithCandidates = {
        sdp: pc.localDescription?.sdp,
        type: pc.localDescription?.type,
        iceCandidates: (pc as any).localIceCandidates || []
      };

      // Publish new offer for late connection
      await publishEvent({
        kind: 31997,
        content: '',
        tags: [
          ['d', roomId],
          ['game', gameId],
          ['players', roomState.requiredPlayers.toString()],
          ['host', user.pubkey],
          ['status', 'active'],
          ['signal', JSON.stringify(offerWithCandidates)]
        ]
      });

      console.log('[MultiplayerRoom] 🕒 Late answer connection initiated successfully');
    } catch (error) {
      console.error('[MultiplayerRoom] Error processing late answer:', error);
      handleConnectionFailure('Failed to process late answer');
    }
  }, [user, roomId, gameId, roomState.requiredPlayers, publishEvent]);

  // Send chat message via WebRTC data channel (not Nostr events)
  const sendChatMessage = useCallback((message: string) => {
    if (!dataChannel || !user) {
      console.warn('[MultiplayerRoom] Cannot send chat message - data channel or user not available');
      return;
    }

    const chatMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: user.pubkey,
      message,
      timestamp: Date.now(),
    };

    try {
      dataChannel.send(JSON.stringify(chatMessage));
      console.log('[MultiplayerRoom] 📤 Chat message sent via WebRTC data channel:', chatMessage);

      // Add to local state immediately for UI feedback
      setRoomState(prev => ({
        ...prev,
        chatMessages: [...(prev.chatMessages || []), chatMessage]
      }));
    } catch (error) {
      console.error('[MultiplayerRoom] Error sending chat message via WebRTC data channel:', error);
      // Fallback: could implement Nostr event fallback here if needed
    }
  }, [dataChannel, user]);

  // Track room initialization to prevent multiple calls
  const roomInitializationRef = useRef<boolean>(false);

  // Initialize room on mount
  useEffect(() => {
    if (roomId && gameId && !roomInitializationRef.current) {
      console.log('[MultiplayerRoom] Initializing room for the first time');
      roomInitializationRef.current = true;

      subscribeToRoom();

      joinOrCreateRoom().catch(error => {
        console.error('[MultiplayerRoom] Error joining/creating room:', error);
        setRoomState(prev => ({
          ...prev,
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to join room'
        }));
      });
    }

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.close();
      }
      if (webRTCConnection) {
        webRTCConnection.close();
      }
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }
      if (connectionHealthCheck) {
        clearTimeout(connectionHealthCheck);
      }
      // Reset initialization flag when room changes
      if (roomId || gameId) {
        roomInitializationRef.current = false;
      }
    };
  }, [roomId, gameId, subscribeToRoom, joinOrCreateRoom]);

  return {
    roomState,
    startGame,
    isHost,
    webRTCConnection,
    localSignal,
    sendGameInput,
    sendGameState,
    sendChatMessage,
    setEmulatorStartCallback,
    joinGame,
    isJoining,
    connectionState,
    iceConnectionState,
    hasConnectionTimedOut,
    retryConnection
  };
}