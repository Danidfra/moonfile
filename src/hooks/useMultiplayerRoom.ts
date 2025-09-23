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
  status: 'waiting' | 'active' | 'full' | 'error' | 'playing';
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
    };
  }, []);

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
              shareableLink: prev.shareableLink // Preserve shareable link
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
              const playerSignalTag = latestEvent.tags.find(t => t[0] === 'player' && t[1] === latestEvent.pubkey)?.[2];

              // Only process if we haven't seen a signal from this peer yet
              if (playerSignalTag && webRTCConnection && !processedPeerSignals.has(latestEvent.pubkey)) {
                console.log('[MultiplayerRoom] Processing answer signal from guest:', latestEvent.pubkey);

                // Check if connection can accept remote description
                if (webRTCConnection.signalingState !== 'stable' &&
                    webRTCConnection.signalingState !== 'closed') {
                  handleRemoteSignal(playerSignalTag, latestEvent.pubkey);
                  // Mark peer as processed
                  setProcessedPeerSignals(prev => new Set([...prev, latestEvent.pubkey]));
                } else {
                  console.warn('[MultiplayerRoom] Skipping answer signal - connection in state:', webRTCConnection.signalingState);
                }

                // Check if connection can accept remote description
                if (webRTCConnection.signalingState !== 'stable' &&
                    webRTCConnection.signalingState !== 'closed') {
                  handleRemoteSignal(playerSignalTag, latestEvent.pubkey);
                } else {
                  console.warn('[MultiplayerRoom] Skipping answer signal - connection in state:', webRTCConnection.signalingState);
                }
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
      console.log('[MultiplayerRoom] Host connection state changed:', pc.connectionState);
      setConnectionState(pc.connectionState);

      // Clear timeout on successful connection
      if (pc.connectionState === 'connected') {
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
          setConnectionTimeout(null);
        }
        setHasConnectionTimedOut(false);
        setIsConnectionEstablished(true);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[MultiplayerRoom] Host ICE connection state changed:', pc.iceConnectionState);
      setIceConnectionState(pc.iceConnectionState);

      // Clear timeout on successful ICE connection
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
          setConnectionTimeout(null);
        }
        setHasConnectionTimedOut(false);
        setIsConnectionEstablished(true);
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log('[MultiplayerRoom] Host ICE gathering state changed:', pc.iceGatheringState);
    };

    // Set connection timeout (10 seconds)
    const timeout = setTimeout(() => {
      console.warn('[MultiplayerRoom] Host connection timeout after 10 seconds');
      setHasConnectionTimedOut(true);
      setRoomState(prev => ({
        ...prev,
        status: 'error',
        error: 'Connection timeout - WebRTC connection failed to establish within 10 seconds'
      }));
    }, 10000);
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
      console.log('[MultiplayerRoom] Chat data channel opened');
      setDataChannel(chatDataChannel);

      // Clear timeout and set connection as established
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        setConnectionTimeout(null);
      }
      setHasConnectionTimedOut(false);
      setIsConnectionEstablished(true);

      // Update connection status and trigger emulator start for host
      setRoomState(prev => ({ ...prev, isWebRTCConnected: true }));

      if (isHost && onEmulatorStart) {
        console.log('[MultiplayerRoom] WebRTC connected, starting emulator on host');
        onEmulatorStart();
      }
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

        // Check if we can safely set remote description
        if (webRTCConnection.signalingState === 'stable') {
          console.warn('[MultiplayerRoom] Cannot set remote answer - connection already stable');
          return;
        }

        if (webRTCConnection.signalingState === 'closed') {
          console.warn('[MultiplayerRoom] Cannot set remote answer - connection closed');
          return;
        }

        // Also check for have-remote-offer state to prevent redundant calls
        if (webRTCConnection.signalingState === 'have-remote-offer') {
          console.warn('[MultiplayerRoom] Cannot set remote answer - already have remote offer');
          return;
        }

        // Check for have-local-offer state (guest side)
        if (webRTCConnection.signalingState === 'have-local-offer') {
          console.warn('[MultiplayerRoom] Cannot set remote answer - already have local offer');
          return;
        }

        console.log('[MultiplayerRoom] Setting remote description for answer');
        await webRTCConnection.setRemoteDescription(signalData);
        console.log('[MultiplayerRoom] Remote description set successfully, new state:', webRTCConnection.signalingState);

        // Only publish status update if this is a new player connection and the player count actually changed
        const isPlayerAlreadyConnected = roomState.connectedPlayers.some(p => p.pubkey === fromPubkey);
        const newPlayerCount = roomState.connectedPlayers.length + 1;

        if (!isPlayerAlreadyConnected && newPlayerCount !== roomState.connectedPlayers.length) {
          // Ensure host tag is present and valid before publishing
          if (!roomState.hostPubkey || !roomState.requiredPlayers) {
            console.error('[MultiplayerRoom] Cannot publish event: missing required host info');
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
                ['host', roomState.hostPubkey], // Ensure host tag is always included
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
                ['host', roomState.hostPubkey], // Ensure host tag is always included
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
          shareableLink
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
          shareableLink
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
        status: 'waiting'
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
        console.log('[MultiplayerRoom] Guest connection state changed:', pc.connectionState);
        setConnectionState(pc.connectionState);

        // Clear timeout on successful connection
        if (pc.connectionState === 'connected') {
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            setConnectionTimeout(null);
          }
          setHasConnectionTimedOut(false);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[MultiplayerRoom] Guest ICE connection state changed:', pc.iceConnectionState);
        setIceConnectionState(pc.iceConnectionState);

        // Clear timeout on successful ICE connection
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            setConnectionTimeout(null);
          }
          setHasConnectionTimedOut(false);
        }
      };

      pc.onicegatheringstatechange = () => {
        console.log('[MultiplayerRoom] Guest ICE gathering state changed:', pc.iceGatheringState);
      };

      // Set connection timeout (10 seconds)
      const timeout = setTimeout(() => {
        console.warn('[MultiplayerRoom] Guest connection timeout after 10 seconds');
        setHasConnectionTimedOut(true);
        setRoomState(prev => ({
          ...prev,
          status: 'error',
          error: 'Connection timeout - WebRTC connection failed to establish within 10 seconds'
        }));
      }, 10000);
      setConnectionTimeout(timeout);

      // Handle incoming data channels from host
      pc.ondatachannel = (event) => {
        const receivedChannel = event.channel;
        console.log('[MultiplayerRoom] Received data channel (guest):', receivedChannel.label);

        if (receivedChannel.label === 'chat') {
          receivedChannel.onopen = () => {
            console.log('[MultiplayerRoom] Chat data channel opened (guest)');
            setDataChannel(receivedChannel);

            // Clear timeout and mark connection as established
            if (connectionTimeout) {
              clearTimeout(connectionTimeout);
              setConnectionTimeout(null);
            }
            setHasConnectionTimedOut(false);
            setIsConnectionEstablished(true);

            setRoomState(prev => ({
              ...prev,
              isWebRTCConnected: true,
              canJoinGame: false
            }));
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
      if (pc.signalingState === 'stable') {
        console.warn('[MultiplayerRoom] Cannot set remote offer - connection already stable');
        throw new Error('Connection already established');
      }

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

      // Validate required fields before publishing
      if (!roomState.hostPubkey || !roomState.requiredPlayers || !roomId || !gameId) {
        console.error('[MultiplayerRoom] Cannot publish answer event: missing required fields', {
          hostPubkey: roomState.hostPubkey,
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

      // Publish answer as new room event
      console.log('[MultiplayerRoom] Publishing answer signal to Nostr');
      await publishEvent({
        kind: 31997,
        content: '',
        tags: [
          ['d', roomId],
          ['game', gameId],
          ['players', roomState.requiredPlayers.toString()],
          ['host', roomState.hostPubkey], // Always include host tag
          ['status', 'active'],
          ['connected', user.pubkey],
          ['player', user.pubkey, answerJson],
          ['connected_count', (roomState.connectedPlayers.length + 1).toString()]
        ]
      });

      console.log('[MultiplayerRoom] Join game process completed successfully');
    } catch (error) {
      console.error('[MultiplayerRoom] Error joining game:', error);
      setRoomState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to join game'
      }));
    } finally {
      setIsJoining(false);
    }
  }, [user, isHost, roomState.pendingHostSignal, roomState.requiredPlayers, roomState.hostPubkey, roomState.connectedPlayers.length, roomId, gameId, publishEvent]);

  // Retry connection after timeout or failure
  const retryConnection = useCallback(() => {
    console.log('[MultiplayerRoom] Retrying connection...');

    // Clear timeout state
    setHasConnectionTimedOut(false);
    setConnectionState('new');
    setIceConnectionState('new');

    // Close existing connection if any
    if (webRTCConnection) {
      webRTCConnection.close();
      setWebRTCConnection(null);
    }

    // Clear data channel
    setDataChannel(null);
    setLocalSignal(null);

    // Reset room state but preserve hostPubkey
    setRoomState(prev => ({
      ...prev,
      status: 'waiting',
      error: undefined,
      isWebRTCConnected: false,
      hostPubkey: prev.hostPubkey // Ensure hostPubkey is preserved
    }));

    // Reset processed events to allow reprocessing
    setProcessedEvents(new Set());
    setProcessedPeerSignals(new Set());

    // Retry join if we're a guest with pending signal
    if (!isHost && roomState.pendingHostSignal) {
      setTimeout(() => {
        joinGame();
      }, 1000); // Small delay before retry
    }
  }, [webRTCConnection, isHost, roomState.pendingHostSignal, joinGame]);

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