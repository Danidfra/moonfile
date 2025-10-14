import { useState, useEffect, useRef, useCallback } from 'react';
import { useNostr } from '@jsr/nostrify__react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useAppContext } from '@/hooks/useAppContext';
import type { NostrEvent } from '@jsr/nostrify__nostrify';

export type SessionStatus = 'idle' | 'creating' | 'available' | 'full' | 'error';

export interface MultiplayerSession {
  sessionId: string;
  gameId: string;
  hostPubkey: string;
  maxPlayers: number;
  status: SessionStatus;
  guests: string[];
  connected: string[];
}

export interface ConnectedPlayer {
  pubkey: string;
  name?: string;
  avatar?: string;
  status: 'connecting' | 'connected' | 'ready';
}

export interface PeerConnection {
  pubkey: string;
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
}

// Type definitions for the new signaling protocol
export type SignalEventType = 'session' | 'join' | 'offer' | 'answer' | 'candidate';

export interface SignalPayload {
  type: 'offer' | 'answer' | 'candidate';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export interface SessionEvent {
  kind: 31997;
  tags: string[][];
  content: string;
}

export interface ParsedSessionEvent {
  type: SignalEventType;
  sessionId: string;
  from?: string;
  to?: string;
  signal?: string;
  host?: string;
  players?: string;
  status?: SessionStatus;
  guests?: string[];
  connected?: string[];
}

export function useMultiplayerSession(gameId: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutate: publishEvent } = useNostrPublish();
  const { config } = useAppContext();

  // Session state
  const [sessionId, setSessionId] = useState<string>('');
  const [session, setSession] = useState<MultiplayerSession | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [connectedPlayers, setConnectedPlayers] = useState<ConnectedPlayer[]>([]);
  const [error, setError] = useState<string | null>(null);

  // WebRTC connections - one per guest for the host
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const hostVideoStreamRef = useRef<MediaStream | null>(null);
  const processedEventIdsRef = useRef<Set<string>>(new Set());

  // Track if session subscription is already active to prevent multiple subscriptions
  const sessionSubscribedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Stable reference to current values for use in subscription
  const currentValuesRef = useRef({
    isHost,
    user,
    session,
    sessionId,
    gameId
  });

  // Update current values ref on each render
  currentValuesRef.current = {
    isHost,
    user,
    session,
    sessionId,
    gameId
  };

  /**
   * Parse session event according to new protocol
   */
  const parseSessionEvent = useCallback((event: NostrEvent): ParsedSessionEvent | null => {
    const tags = event.tags || [];

    const getTag = (name: string) => tags.find(t => t[0] === name)?.[1];
    const getTagValues = (name: string) => tags.filter(t => t[0] === name).map(t => t[1]);

    const type = getTag('type') as SignalEventType;
    if (!type) return null;

    const parsed: ParsedSessionEvent = {
      type,
      sessionId: getTag('d') || '',
    };

    // Optional fields
    const from = getTag('from');
    const to = getTag('to');
    const signal = getTag('signal');
    const host = getTag('host');
    const players = getTag('players');
    const status = getTag('status') as SessionStatus;
    const guests = getTagValues('guest');
    const connected = getTagValues('connected');

    if (from) parsed.from = from;
    if (to) parsed.to = to;
    if (signal) parsed.signal = signal;
    if (host) parsed.host = host;
    if (players) parsed.players = players;
    if (status) parsed.status = status;
    if (guests.length > 0) parsed.guests = guests;
    if (connected.length > 0) parsed.connected = connected;

    return parsed;
  }, []);

  /**
   * Publish session state update
   */
  const publishSessionState = useCallback(async (updates: {
    status?: SessionStatus;
    guests?: string[];
    connected?: string[];
    maxPlayers?: number;
  }) => {
    if (!user || !sessionId) return;

    const tags = [
      ['d', sessionId],
      ['type', 'session'],
      ['host', user.pubkey],
      ['players', (updates.maxPlayers || session?.maxPlayers || 2).toString()],
    ];

    if (updates.status) tags.push(['status', updates.status]);
    if (updates.guests) updates.guests.forEach(g => tags.push(['guest', g]));
    if (updates.connected) updates.connected.forEach(c => tags.push(['connected', c]));

    publishEvent({
      kind: 31997,
      content: '',
      tags,
      relays: [config.relayUrl]
    });
  }, [user, sessionId, session, publishEvent, config.relayUrl]);

  /**
   * Publish signal message
   */
  const publishSignal = useCallback(async (
    type: 'offer' | 'answer' | 'candidate' | 'join',
    to: string,
    payload?: any
  ) => {
    if (!user || !sessionId) return;

    const tags = [
      ['d', sessionId],
      ['type', type],
      ['from', user.pubkey],
      ['to', to],
    ];

    if (payload) {
      tags.push(['signal', btoa(JSON.stringify(payload))]);
    }

    publishEvent({
      kind: 31997,
      content: '',
      tags,
      relays: [config.relayUrl]
    });
  }, [user, sessionId, publishEvent, config.relayUrl]);

  /**
   * Create WebRTC peer connection for a specific guest
   */
  const createPeerConnection = useCallback((guestPubkey: string): RTCPeerConnection => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Add video track if host
    if (isHost && hostVideoStreamRef.current) {
      hostVideoStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, hostVideoStreamRef.current!);
      });
    }

    // Create data channel for game input (host only)
    if (isHost) {
      const dataChannel = peerConnection.createDataChannel('inputs', {
        ordered: true
      });

      dataChannel.onopen = () => {
        console.log('[MultiplayerSession] Data channel opened for guest:', guestPubkey);
      };

      dataChannel.onmessage = (event) => {
        try {
          const input = JSON.parse(event.data);
          if (input.type === 'input' && input.key !== undefined) {
            // Forward to emulator iframe
            const emulatorElement = document.querySelector('iframe') as HTMLIFrameElement;
            if (emulatorElement?.contentWindow) {
              emulatorElement.contentWindow.postMessage({
                type: 'remote-input',
                payload: { key: input.key, pressed: input.pressed }
              }, window.location.origin);
            }
          }
        } catch (err) {
          console.error('[MultiplayerSession] Failed to parse data channel message:', err);
        }
      };

      // Store the peer connection with data channel
      peerConnectionsRef.current.set(guestPubkey, {
        pubkey: guestPubkey,
        connection: peerConnection,
        dataChannel
      });
    } else {
      // Guest side - just store the connection
      peerConnectionsRef.current.set(guestPubkey, {
        pubkey: guestPubkey,
        connection: peerConnection
      });
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        publishSignal('candidate', guestPubkey, event.candidate);
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('[MultiplayerSession] Connection state for guest:', guestPubkey, peerConnection.connectionState);

      setConnectedPlayers(prev =>
        prev.map(player =>
          player.pubkey === guestPubkey
            ? { ...player, status: peerConnection.connectionState === 'connected' ? 'connected' : 'connecting' }
            : player
        )
      );
    };

    // Guest side: handle incoming data channel
    if (!isHost) {
      peerConnection.ondatachannel = (event) => {
        const dataChannel = event.channel;
        dataChannel.onopen = () => {
          console.log('[MultiplayerSession] Guest data channel opened');
        };

        // Store data channel reference
        const existing = peerConnectionsRef.current.get(guestPubkey);
        if (existing) {
          existing.dataChannel = dataChannel;
        }
      };
    }

    return peerConnection;
  }, [isHost, publishSignal]);



  /**
   * Unified subscription handler for all session events
   */
  const handleSessionEvent = useCallback(async (event: NostrEvent) => {
    if (processedEventIdsRef.current.has(event.id)) {
      return; // Skip already processed events
    }
    processedEventIdsRef.current.add(event.id);

    const parsed = parseSessionEvent(event);
    if (!parsed || !parsed.sessionId) {
      return;
    }

    console.log('[MultiplayerSession] Handling event:', { id: event.id, parsed });

    const { user: currentUser, isHost: currentIsHost } = currentValuesRef.current;

    // Handle session state updates
    if (parsed.type === 'session' && parsed.host) {
      const newSession: MultiplayerSession = {
        sessionId: parsed.sessionId,
        gameId,
        hostPubkey: parsed.host,
        maxPlayers: parseInt(parsed.players || '2'),
        status: parsed.status || 'available',
        guests: parsed.guests || [],
        connected: parsed.connected || [],
      };

      setSession(newSession);
      setStatus(newSession.status);
      return;
    }

    // Host-side event handling
    if (currentIsHost && currentUser) {
      switch (parsed.type) {
        case 'join':
          if (parsed.from && parsed.to === currentUser.pubkey) {
            console.log('[MultiplayerSession] Guest joined:', parsed.from);

            // Create peer connection for this guest
            const peerConnection = createPeerConnection(parsed.from);

            // Add to connected players
            setConnectedPlayers(prev => [
              ...prev.filter(p => p.pubkey !== parsed.from),
              { pubkey: parsed.from!, status: 'connecting' }
            ]);

            // Create and send offer
            try {
              const offer = await peerConnection.createOffer();
              await peerConnection.setLocalDescription(offer);
              publishSignal('offer', parsed.from, offer);
            } catch (err) {
              console.error('[MultiplayerSession] Failed to create offer:', err);
            }
          }
          break;

        case 'answer':
          if (parsed.from && parsed.to === currentUser.pubkey && parsed.signal) {
            console.log('[MultiplayerSession] Received answer from:', parsed.from);
            const peer = peerConnectionsRef.current.get(parsed.from);
            if (peer) {
              try {
                const answer = JSON.parse(atob(parsed.signal));
                await peer.connection.setRemoteDescription(answer);
              } catch (err) {
                console.error('[MultiplayerSession] Failed to set remote answer:', err);
              }
            }
          }
          break;

        case 'candidate':
          if (parsed.from && parsed.to === currentUser.pubkey && parsed.signal) {
            console.log('[MultiplayerSession] Received candidate from:', parsed.from);
            const peer = peerConnectionsRef.current.get(parsed.from);
            if (peer) {
              try {
                const candidate = JSON.parse(atob(parsed.signal));
                await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (err) {
                console.error('[MultiplayerSession] Failed to add ICE candidate:', err);
              }
            }
          }
          break;
      }
    }

    // Guest-side event handling
    if (!currentIsHost && currentUser) {
      switch (parsed.type) {
        case 'offer':
          if (parsed.to === currentUser.pubkey && parsed.signal && parsed.from) {
            console.log('[MultiplayerSession] Received offer from host');

            // Create peer connection for host
            const peerConnection = createPeerConnection(parsed.from);

            try {
              const offer = JSON.parse(atob(parsed.signal));
              await peerConnection.setRemoteDescription(offer);

              const answer = await peerConnection.createAnswer();
              await peerConnection.setLocalDescription(answer);
              publishSignal('answer', parsed.from, answer);
            } catch (err) {
              console.error('[MultiplayerSession] Failed to handle offer:', err);
            }
          }
          break;

        case 'candidate':
          if (parsed.to === currentUser.pubkey && parsed.signal && parsed.from) {
            console.log('[MultiplayerSession] Received candidate from host');
            const peer = peerConnectionsRef.current.get(parsed.from);
            if (peer) {
              try {
                const candidate = JSON.parse(atob(parsed.signal));
                await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (err) {
                console.error('[MultiplayerSession] Failed to add ICE candidate:', err);
              }
            }
          }
          break;
      }
    }
  }, [parseSessionEvent, createPeerConnection, publishSignal]);

  /**
   * Start unified session subscription
   */
  const startUnifiedSessionSubscription = useCallback((sessionIdToSubscribe: string) => {
    if (!nostr || !config || sessionSubscribedRef.current) {
      return;
    }

    console.log('[MultiplayerSession] Starting unified session subscription for:', sessionIdToSubscribe);
    sessionSubscribedRef.current = true;

    // Create new AbortController for this subscription
    abortControllerRef.current = new AbortController();

    const mainRelay = nostr.relay(config.relayUrl);

    const handleSubscription = async () => {
      try {
        for await (const ev of mainRelay.req([{
          kinds: [31997],
          '#d': [sessionIdToSubscribe],
          since: Math.floor(Date.now() / 1000) - 60
        }], { signal: abortControllerRef.current!.signal })) {
          if (ev[0] === 'EVENT') {
            const event = ev[2];
            handleSessionEvent(event);
          } else if (ev[0] === 'EOSE') {
            console.log('[MultiplayerSession] Session subscription EOSE');
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('[MultiplayerSession] Session subscription aborted');
        } else {
          console.error('[MultiplayerSession] Session subscription error:', err);
        }
        sessionSubscribedRef.current = false;
      }
    };

    handleSubscription();
  }, [nostr, config, handleSessionEvent]);


  /**
   * Generate unique session ID in the format: game:<gameDTag>:room:<randomId>
   */
  const generateSessionId = (gameId: string): string => {
    const randomId = 'room_' + Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    // gameId already includes "game:" prefix from the d tag
    return `${gameId}:room:${randomId}`;
  };

  /**
   * Start multiplayer session as host
   */
  const startSession = useCallback(async (videoStream: MediaStream, maxPlayers: number = 2) => {
    if (!user) {
      setError('Must be logged in to start session');
      return;
    }

    try {
      setStatus('creating');
      setError(null);

      const newSessionId = generateSessionId(gameId);
      setSessionId(newSessionId);
      setIsHost(true);

      // Store the video stream
      hostVideoStreamRef.current = videoStream;

      // Publish initial session state (no offer yet)
      await publishSessionState({
        status: 'available',
        maxPlayers,
        guests: [],
        connected: []
      });

      setStatus('available');
      console.log('[MultiplayerSession] Session started:', newSessionId);

    } catch (err) {
      console.error('[MultiplayerSession] Failed to start session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setStatus('error');
    }
  }, [user, gameId, publishSessionState]);

  /**
   * Join existing session as guest
   */
  const joinSession = useCallback(async (sessionId: string) => {
    if (!user) {
      setError('Must be logged in to join session');
      return;
    }

    try {
      setStatus('creating');
      setError(null);
      setSessionId(sessionId);
      setIsHost(false);

      // Fetch the latest session event to get host pubkey
      const events = await nostr.query([{
        kinds: [31997],
        '#d': [sessionId],
        limit: 1
      }], { signal: AbortSignal.timeout(10000) });

      if (events.length === 0) {
        throw new Error('Session not found');
      }

      const sessionEvent = events[0] as NostrEvent;
      const parsed = parseSessionEvent(sessionEvent);

      if (!parsed || !parsed.host || parsed.status === 'full') {
        throw new Error('Invalid session or session is full');
      }

      // Publish join intent
      await publishSignal('join', parsed.host);

      setStatus('available');
      console.log('[MultiplayerSession] Joined session:', sessionId);

    } catch (err) {
      console.error('[MultiplayerSession] Failed to join session:', err);
      setError(err instanceof Error ? err.message : 'Failed to join session');
      setStatus('error');
    }
  }, [user, nostr, publishSignal, parseSessionEvent]);

  /**
   * Subscribe to session updates
   */
  useEffect(() => {
    if (!sessionId || !nostr || sessionSubscribedRef.current) return;

    console.log('[MultiplayerSession] Initializing session subscription for:', sessionId);
    startUnifiedSessionSubscription(sessionId);

    return () => {
      console.log('[MultiplayerSession] Cleaning up session subscription for:', sessionId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      sessionSubscribedRef.current = false;
      processedEventIdsRef.current.clear();
    };
  }, [sessionId, startUnifiedSessionSubscription]);

  /**
   * Leave session
   */
  const leaveSession = useCallback(() => {
    // Abort any ongoing subscription
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach(({ connection }) => {
      connection.close();
    });
    peerConnectionsRef.current.clear();

    // Reset state
    setSessionId('');
    setSession(null);
    setIsHost(false);
    setStatus('idle');
    setConnectedPlayers([]);
    setError(null);
    hostVideoStreamRef.current = null;
    sessionSubscribedRef.current = false;
    processedEventIdsRef.current.clear();
  }, []);

  /**
   * Get peer connection for a guest (host only)
   */
  const getPeerConnection = useCallback((guestPubkey: string): RTCPeerConnection | null => {
    const peer = peerConnectionsRef.current.get(guestPubkey);
    return peer?.connection || null;
  }, []);

  /**
   * Send game input via data channel (guest only)
   */
  const sendGameInput = useCallback((inputData: { key: string; pressed: boolean }) => {
    if (isHost) return; // Only guests send input

    // Find the host connection (guests only have one connection)
    const connections = Array.from(peerConnectionsRef.current.values());
    if (connections.length > 0) {
      const dataChannel = connections[0].dataChannel;
      if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({
          type: 'input',
          timestamp: Date.now(),
          ...inputData
        }));
      }
    }
  }, [isHost]);

  return {
    sessionId,
    session,
    isHost,
    status,
    connectedPlayers,
    error,
    startSession,
    joinSession,
    leaveSession,
    getPeerConnection,
    sendGameInput
  };
}