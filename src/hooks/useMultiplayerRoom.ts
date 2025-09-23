import { useState, useEffect, useCallback, useRef } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import type { NostrEvent } from '@nostrify/nostrify';

interface ConnectedPlayer {
  pubkey: string;
  signal?: string;
}

interface RoomState {
  status: 'waiting' | 'active' | 'full' | 'error' | 'playing';
  hostPubkey: string;
  requiredPlayers: number;
  connectedPlayers: ConnectedPlayer[];
  latestEvent: NostrEvent | null;
  error?: string;
  shareableLink?: string;
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
  });

  const [webRTCConnection, setWebRTCConnection] = useState<RTCPeerConnection | null>(null);
  const [localSignal, setLocalSignal] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);

  const subscriptionRef = useRef<{ close: () => void } | null>(null);

  // Parse room event from Nostr event
  const parseRoomEvent = useCallback((event: NostrEvent): RoomState => {
    const dTag = event.tags.find(t => t[0] === 'd')?.[1];
    const gameTag = event.tags.find(t => t[0] === 'game')?.[1];
    const playersTag = event.tags.find(t => t[0] === 'players')?.[1];
    const hostTag = event.tags.find(t => t[0] === 'host')?.[1];
    const statusTag = event.tags.find(t => t[0] === 'status')?.[1];
    const signalTag = event.tags.find(t => t[0] === 'signal')?.[1];
    const connectedTag = event.tags.find(t => t[0] === 'connected')?.[1];
    const connectedCountTag = event.tags.find(t => t[0] === 'connected_count')?.[1];

    if (!dTag || !gameTag || !playersTag || !hostTag) {
      throw new Error('Invalid room event: missing required tags');
    }

    const requiredPlayers = parseInt(playersTag, 10);
    if (isNaN(requiredPlayers) || requiredPlayers < 1) {
      throw new Error('Invalid players count');
    }

    // Parse connected players
    const connectedPlayers: ConnectedPlayer[] = [];

    // Add host
    connectedPlayers.push({
      pubkey: hostTag,
      signal: signalTag
    });

    // Add connected players from tags
    if (connectedTag) {
      // Find player signal for this connected player
      const playerSignal = event.tags.find(t => t[0] === 'player' && t[1] === connectedTag)?.[2];
      connectedPlayers.push({
        pubkey: connectedTag,
        signal: playerSignal
      });
    }

    // Also check for any other connected players
    const otherConnected = event.tags
      .filter(t => t[0] === 'connected' && t[1] && t[1] !== hostTag && t[1] !== connectedTag)
      .map(t => {
        const playerSignal = event.tags.find(tag => tag[0] === 'player' && tag[1] === t[1])?.[2];
        return {
          pubkey: t[1],
          signal: playerSignal
        };
      });

    connectedPlayers.push(...otherConnected);

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
          try {
            const newRoomState = parseRoomEvent(latestEvent);
            setRoomState(newRoomState);

            // If we have a signal from another player and we're not the host, handle it
            if (user && latestEvent.pubkey !== user.pubkey && !isHost) {
              const signalTag = latestEvent.tags.find(t => t[0] === 'signal')?.[1];
              if (signalTag && !localSignal) {
                handleRemoteSignal(signalTag, latestEvent.pubkey);
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

    // Create data channel for game state and input
    const dataChannel = pc.createDataChannel('game-data');

    dataChannel.onopen = () => {
      console.log('[MultiplayerRoom] Data channel opened');
    };

    dataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[MultiplayerRoom] Received game input:', data);
        // Handle game input messages from peers (arrow keys, buttons, etc.)
        // This will be forwarded to the emulator
      } catch (error) {
        console.error('[MultiplayerRoom] Error parsing message:', error);
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
    if (!webRTCConnection) return;

    try {
      console.log('[MultiplayerRoom] Handling remote signal from:', fromPubkey);

      const signalData = JSON.parse(signal);

      if (signalData.type === 'answer') {
        await webRTCConnection.setRemoteDescription(signalData);
        console.log('[MultiplayerRoom] Remote description set');

        // Update room state to active when connection is established
        if (roomState.connectedPlayers.length >= roomState.requiredPlayers) {
          await publishEvent({
            kind: 31997,
            content: '',
            tags: [
              ['d', roomId],
              ['game', gameId],
              ['players', roomState.requiredPlayers.toString()],
              ['host', roomState.hostPubkey],
              ['status', 'full'],
              ['connected_count', roomState.connectedPlayers.length.toString()]
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
              ['host', roomState.hostPubkey],
              ['status', 'active'],
              ['connected_count', roomState.connectedPlayers.length.toString()]
            ]
          });
        }
      } else if (signalData.type === 'offer') {
        // Handle incoming offer (non-host)
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });

        pc.ondatachannel = (event) => {
          const dataChannel = event.channel;
          dataChannel.onopen = () => {
            console.log('[MultiplayerRoom] Data channel opened (peer)');
          };
          dataChannel.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              console.log('[MultiplayerRoom] Received game state (peer):', data);
              // Handle game state updates from host (video stream, game data)
            } catch (error) {
              console.error('[MultiplayerRoom] Error parsing message (peer):', error);
            }
          };
        };

        await pc.setRemoteDescription(signalData);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        setWebRTCConnection(pc);
        setLocalSignal(JSON.stringify(answer));

        // Publish answer with connected player info
        await publishEvent({
          kind: 31997,
          content: '',
          tags: [
            ['d', roomId],
            ['game', gameId],
            ['players', roomState.requiredPlayers.toString()],
            ['host', roomState.hostPubkey],
            ['status', 'active'],
            ['connected', user?.pubkey || ''],
            ['player', user?.pubkey || '', JSON.stringify(answer)],
            ['connected_count', (roomState.connectedPlayers.length + 1).toString()]
          ]
        });

        console.log('[MultiplayerRoom] Answer published');
      }
    } catch (error) {
      console.error('[MultiplayerRoom] Error handling remote signal:', error);
    }
  }, [webRTCConnection, roomId, gameId, roomState.requiredPlayers, roomState.hostPubkey, roomState.connectedPlayers.length, user, publishEvent]);

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
      // Room exists, join as player
      console.log('[MultiplayerRoom] Room exists, joining as player');
      const roomEvent = existingEvents[0];
      const roomData = parseRoomEvent(roomEvent);

      if (roomData.connectedPlayers.length >= roomData.requiredPlayers) {
        throw new Error('Room is full');
      }

      setIsHost(false);
      // Wait for host signal and respond with answer
      // This will be handled in the subscription when we receive the offer
    } else {
      // Create new room as host
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

      // Update state with shareable link
      setRoomState(prev => ({
        ...prev,
        requiredPlayers: playerCount,
        hostPubkey: user.pubkey,
        shareableLink
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

  // Initialize room on mount
  useEffect(() => {
    if (roomId && gameId) {
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
    };
  }, [roomId, gameId, subscribeToRoom, joinOrCreateRoom]);

  return {
    roomState,
    startGame,
    isHost,
    webRTCConnection,
    localSignal,
    sendGameInput,
    sendGameState
  };
}