import { useState, useEffect, useCallback, useRef } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import type { NostrEvent } from '@nostrify/nostrify';

interface MultiplayerRoomEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

interface PlayerInfo {
  pubkey: string;
  connected: boolean;
  isHost: boolean;
  signal?: string; // WebRTC offer/answer
}

interface RoomState {
  status: 'waiting' | 'connecting' | 'ready' | 'playing' | 'error';
  players: PlayerInfo[];
  hostPubkey: string;
  requiredPlayers: number;
  error?: string;
}

export function useMultiplayerRoom(roomId: string, gameId: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();

  const [roomState, setRoomState] = useState<RoomState>({
    status: 'waiting',
    players: [],
    hostPubkey: '',
    requiredPlayers: 2,
  });

  const [webRTCConnection, setWebRTCConnection] = useState<RTCPeerConnection | null>(null);
  const [localSignal, setLocalSignal] = useState<string | null>(null);

  const subscriptionRef = useRef<{ close: () => void } | null>(null);

  // Parse room event from Nostr event
  const parseRoomEvent = useCallback((event: NostrEvent): RoomState => {
    const dTag = event.tags.find(t => t[0] === 'd')?.[1];
    const gameTag = event.tags.find(t => t[0] === 'game')?.[1];
    const playersTag = event.tags.find(t => t[0] === 'players')?.[1];
    const hostTag = event.tags.find(t => t[0] === 'host')?.[1];
    const statusTag = event.tags.find(t => t[0] === 'status')?.[1];
    const signalTag = event.tags.find(t => t[0] === 'signal')?.[1];

    if (!dTag || !gameTag || !playersTag || !hostTag) {
      throw new Error('Invalid room event: missing required tags');
    }

    const requiredPlayers = parseInt(playersTag, 10);
    if (isNaN(requiredPlayers) || requiredPlayers < 1) {
      throw new Error('Invalid players count');
    }

    // Parse players from event tags
    const players: PlayerInfo[] = [
      {
        pubkey: hostTag,
        connected: true,
        isHost: true,
        signal: signalTag
      }
    ];

    // Find other player signals
    const otherPlayers = event.tags
      .filter(t => t[0] === 'player' && t[1] && t[1] !== hostTag)
      .map(t => ({
        pubkey: t[1],
        connected: true,
        isHost: false,
        signal: t[2]
      }));

    players.push(...otherPlayers);

    return {
      status: statusTag === 'ready' ? 'ready' : 'waiting',
      players,
      hostPubkey: hostTag,
      requiredPlayers,
    };
  }, []);

  // Subscribe to room updates
  const subscribeToRoom = useCallback(async () => {
    if (!nostr || !roomId) return;

    // Close existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.close();
      subscriptionRef.current = null;
    }

    console.log('[MultiplayerRoom] Subscribing to room updates:', roomId);

    // Use query instead of req for simpler subscription
    const queryController = new AbortController();

    const fetchRoomEvents = async () => {
      try {
        const events = await nostr.query([{
          kinds: [31997],
          '#d': [roomId],
          limit: 50
        }], {
          signal: queryController.signal
        });

        // Process existing events
        events.forEach((event: NostrEvent) => {
          console.log('[MultiplayerRoom] Received room event:', event.id);

          try {
            const newRoomState = parseRoomEvent(event);
            setRoomState(newRoomState);

            // If we have a signal from another player, handle it
            if (user && event.pubkey !== user.pubkey) {
              const signalTag = event.tags.find(t => t[0] === 'signal')?.[1];
              if (signalTag) {
                handleRemoteSignal(signalTag, event.pubkey);
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
        });

        console.log('[MultiplayerRoom] Initial room events loaded');
      } catch (error) {
        console.error('[MultiplayerRoom] Error fetching room events:', error);
      }
    };

    fetchRoomEvents();

    // Set up periodic polling for new events (simplified approach)
    const interval = setInterval(fetchRoomEvents, 5000);

    subscriptionRef.current = {
      close: () => {
        queryController.abort();
        clearInterval(interval);
      }
    };

  }, [nostr, roomId, user, parseRoomEvent]);

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

    // Create data channel for game state
    const dataChannel = pc.createDataChannel('game-state');

    dataChannel.onopen = () => {
      console.log('[MultiplayerRoom] Data channel opened');
    };

    dataChannel.onmessage = (event) => {
      console.log('[MultiplayerRoom] Received message:', event.data);
      // Handle game input messages from peers
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
            console.log('[MultiplayerRoom] Received message (peer):', event.data);
          };
        };

        await pc.setRemoteDescription(signalData);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        setWebRTCConnection(pc);

        // Publish answer
        await publishEvent({
          kind: 31997,
          content: '',
          tags: [
            ['d', roomId],
            ['game', gameId],
            ['players', roomState.requiredPlayers.toString()],
            ['host', roomState.hostPubkey],
            ['status', 'connecting'],
            ['player', user?.pubkey || ''],
            ['signal', JSON.stringify(pc.localDescription)]
          ]
        });

        console.log('[MultiplayerRoom] Answer published');
      }
    } catch (error) {
      console.error('[MultiplayerRoom] Error handling remote signal:', error);
    }
  }, [webRTCConnection, roomId, gameId, roomState.requiredPlayers, roomState.hostPubkey, user, publishEvent]);

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

      if (roomData.players.length >= roomData.requiredPlayers) {
        throw new Error('Room is full');
      }

      // Wait for host signal and respond with answer
      // This will be handled in the subscription
    } else {
      // Create new room as host
      console.log('[MultiplayerRoom] Creating new room as host');

      const offer = await createWebRTCOffer();

      await publishEvent({
        kind: 31997,
        content: '',
        tags: [
          ['d', roomId],
          ['game', gameId],
          ['players', '2'], // Default to 2 players
          ['host', user.pubkey],
          ['status', 'waiting'],
          ['signal', offer]
        ]
      });

      console.log('[MultiplayerRoom] Room created successfully');
    }
  }, [user, roomId, gameId, nostr, parseRoomEvent, createWebRTCOffer, publishEvent]);

  // Start game when all players are ready
  const startGame = useCallback(async () => {
    if (!user || roomState.status !== 'ready') {
      throw new Error('Cannot start game: not ready');
    }

    console.log('[MultiplayerRoom] Starting game...');

    // Update room status to playing
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
  }, [user, roomState, roomId, gameId, publishEvent]);

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

  // Update room state based on player connections
  useEffect(() => {
    if (roomState.players.length >= roomState.requiredPlayers &&
        roomState.players.every(p => p.connected) &&
        roomState.status === 'waiting') {
      setRoomState(prev => ({ ...prev, status: 'ready' }));
    }
  }, [roomState.players, roomState.requiredPlayers, roomState.status]);

  return {
    roomState,
    startGame,
    isHost: user?.pubkey === roomState.hostPubkey,
    webRTCConnection,
    localSignal
  };
}