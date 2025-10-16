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

  // Track if remoteDescription was set per peer
  const remoteDescSetRef = useRef<Map<string, boolean>>(new Map());
  // Queue ICE candidates that arrive before remoteDescription is set
  const pendingRemoteCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // Update current values ref on each render
  currentValuesRef.current = {
    isHost,
    user,
    session,
    sessionId,
    gameId
  };

  /**
   *
   */
  const buildSnapshot = (): {
    status: SessionStatus;
    guests: string[];
    connected: string[];
    maxPlayers: number;
  } => {
    const s = currentValuesRef.current.session;
    const connected = Array
      .from(peerConnectionsRef.current.values())
      .filter(p => p.connection.connectionState === 'connected')
      .map(p => p.pubkey);

    const maxP = s?.maxPlayers ?? 2;
    const status: SessionStatus = connected.length + 1 >= maxP ? 'full' : 'available'; // +1 host

    return {
      status,
      guests: s?.guests ?? [],
      connected,
      maxPlayers: maxP,
    };
  };

  /**
   * Parse session event according to new protocol
   */
  const parseSessionEvent = useCallback((event: NostrEvent): ParsedSessionEvent | null => {
    const tags = event.tags || [];
    const getTag = (n: string) => tags.find(t => t[0] === n)?.[1];
    const getVals = (n: string) => tags.filter(t => t[0] === n).map(t => t[1]);

    const type = getTag('type') as SignalEventType;
    if (!type) return null;

    let signal = getTag('signal');
    if ((!signal || signal === 'content') && event.content) {
      // keep downstream compatibility: `parsed.signal` stays base64
      signal = btoa(unescape(encodeURIComponent(event.content)));
    }

    return {
      type,
      sessionId: getTag('d') || '',
      from: getTag('from'),
      to: getTag('to'),
      signal,
      host: getTag('host'),
      players: getTag('players'),
      status: getTag('status') as SessionStatus,
      guests: getVals('guest'),
      connected: getVals('connected'),
    };
  }, []);

  /**
   * Publish session state update
   */
  const publishSessionState = useCallback(async (
    targetSessionId: string,
    updates: {
      status?: SessionStatus;
      guests?: string[];
      connected?: string[];
      maxPlayers?: number;
    }
  ) => {
    if (!user || !targetSessionId) return;

    const tags = [
      ['d', targetSessionId],
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
  }, [user, session, publishEvent, config.relayUrl]);

  /**
   * Publish signal message
   */
  const publishSignal = useCallback(async (
    type: 'offer' | 'answer' | 'candidate' | 'join',
    to: string,
    payload?: RTCSessionDescriptionInit | RTCIceCandidateInit
  ) => {
    if (!user || !sessionId) return;

    const signalJson = payload ? JSON.stringify(payload) : '';
    const signalB64 = signalJson ? btoa(unescape(encodeURIComponent(signalJson))) : undefined;
    const useContent = !!signalJson && (type === 'offer' || type === 'answer' || type === 'candidate');

    const baseTags: string[][] = [
      ['d', sessionId],
      ['type', type],
      ['from', user.pubkey],
      ['to', to],
    ];
    const tags = useContent
      ? [...baseTags, ['signal', 'content']]
      : (signalB64 ? [...baseTags, ['signal', signalB64]] : baseTags);

    console.log('[SIG/PUB] ->', {
      type, to, sessionId,
      mode: useContent ? 'content' : 'tag',
      jsonLen: signalJson.length, b64Len: signalB64?.length
    });

    try {
      await publishEvent({
        kind: 31997,
        content: useContent ? signalJson : '',
        tags,
        relays: [config.relayUrl]
      });
      console.log('[SIG/OK]', type, '->', to, 'mode=', useContent ? 'content' : 'tag');
    } catch (e) {
      console.error('[SIG/ERR]', type, e);
    }
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

  const { isHost: isHostNow } = currentValuesRef.current;

  // Ensure the offer has an m=video
  if (isHostNow) {
    const stream = hostVideoStreamRef.current;
    if (stream && stream.getTracks().length) {
      stream.getTracks().forEach(t => peerConnection.addTrack(t, stream));
    } else {
      // SDP must still advertise video even if the track isn't ready yet
      peerConnection.addTransceiver('video', { direction: 'sendonly' });
    }
  }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      const c = event.candidate;
      if (c && event.candidate) {
        publishSignal('candidate', guestPubkey, event.candidate);
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('[MultiplayerSession] Connection state for guest:', guestPubkey, peerConnection.connectionState);
      const state = peerConnection.connectionState;

      setConnectedPlayers(prev =>
        prev.map(player =>
          player.pubkey === guestPubkey
            ? { ...player, status: state === 'connected' ? 'connected' : 'connecting' }
            : player
        )
      );

      if (isHostNow && state === 'connected') {
        publishSessionState(currentValuesRef.current.sessionId, buildSnapshot());
      }
    };

 if (isHostNow) {
    const dc = peerConnection.createDataChannel('inputs', { ordered: true });
    dc.onopen = () => console.log('[Host] datachannel open ->', guestPubkey);
    peerConnectionsRef.current.set(guestPubkey, { pubkey: guestPubkey, connection: peerConnection, dataChannel: dc });
  } else {
    peerConnectionsRef.current.set(guestPubkey, { pubkey: guestPubkey, connection: peerConnection });
    peerConnection.ondatachannel = (evt) => {
      const dc = evt.channel;
      dc.onopen = () => console.log('[Guest] datachannel open');
      const existing = peerConnectionsRef.current.get(guestPubkey);
      if (existing) existing.dataChannel = dc;
    };
  }

    return peerConnection;
  }, [publishSignal, publishSessionState]);



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
            if (!peerConnectionsRef.current.get(parsed.from)) {
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
                await publishSignal('offer', parsed.from, offer);
                console.log('[Host] OFFER sent to', parsed.from);

                // Publish session snapshot that includes the new guest
                await publishSessionState(currentValuesRef.current.sessionId, {
                  status: 'available',
                  guests: [ ...(session?.guests ?? []), parsed.from! ],
                  connected: [ ...(session?.connected ?? []) ],
                });
              } catch (err) {
                console.error('[MultiplayerSession] Failed to create offer:', err);
              }
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

                // mark that remote SDP is set
                remoteDescSetRef.current.set(parsed.from, true);

                // flush queued remote candidates (if any)
                const queued = pendingRemoteCandidatesRef.current.get(parsed.from) || [];
                for (const cand of queued) {
                  try {
                    await peer.connection.addIceCandidate(new RTCIceCandidate(cand));
                  } catch (e) {
                    console.warn('[Host] Failed to add queued candidate:', e);
                  }
                }
                pendingRemoteCandidatesRef.current.delete(parsed.from);

              } catch (err) {
                console.error('[MultiplayerSession] Failed to set remote answer:', err);
              }
            }
          }
          break;

        case 'candidate':
          if (parsed.from && parsed.to === currentUser.pubkey && parsed.signal) {
            const peer = peerConnectionsRef.current.get(parsed.from);
            if (peer) {
              try {
                const cand: RTCIceCandidateInit = JSON.parse(atob(parsed.signal));

                // if remote SDP not set yet, queue
                if (!remoteDescSetRef.current.get(parsed.from) || !peer.connection.remoteDescription) {
                  const q = pendingRemoteCandidatesRef.current.get(parsed.from) || [];
                  q.push(cand);
                  pendingRemoteCandidatesRef.current.set(parsed.from, q);
                  return;
                }

                await peer.connection.addIceCandidate(new RTCIceCandidate(cand));
              } catch (err) {
                console.error('[Host] Failed to add ICE candidate:', err);
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

              remoteDescSetRef.current.set(parsed.from, true);

              const queued = pendingRemoteCandidatesRef.current.get(parsed.from) || [];

              for (const cand of queued) {
                try {
                  await peerConnection.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {
                  console.warn('[Guest] Failed to add queued candidate:', e);
                }
              }
              pendingRemoteCandidatesRef.current.delete(parsed.from);

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
              const peer = peerConnectionsRef.current.get(parsed.from);
              if (peer) {
                try {
                  const cand: RTCIceCandidateInit = JSON.parse(atob(parsed.signal));

                  // If we haven't set the host's offer yet, queue
                  const key = parsed.from; // host pubkey as key
                  if (!remoteDescSetRef.current.get(key) || !peer.connection.remoteDescription) {
                    const q = pendingRemoteCandidatesRef.current.get(key) || [];
                    q.push(cand);
                    pendingRemoteCandidatesRef.current.set(key, q);
                    return;
                  }

                  await peer.connection.addIceCandidate(new RTCIceCandidate(cand));
                } catch (err) {
                  console.error('[Guest] Failed to add ICE candidate:', err);
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

      // Start subscription early to prevent missing early join/offer events
      startUnifiedSessionSubscription(newSessionId);

      // Store the video stream
      hostVideoStreamRef.current = videoStream;

      // Publish initial session state using the newSessionId directly
      await publishSessionState(newSessionId, {
        status: 'available',
        maxPlayers,
        guests: [],
        connected: []
      });

      // Set local session state for UI consistency
      setStatus('available');
      console.log('[MultiplayerSession] Session started:', newSessionId);

    } catch (err) {
      console.error('[MultiplayerSession] Failed to start session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setStatus('error');
    }
  }, [user, gameId, publishSessionState, startUnifiedSessionSubscription]);

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

      // Use the same relay for query to avoid cross-relay races
      const mainRelay = nostr.relay(config.relayUrl);

      // Fetch the latest session events with small since window and filter for type=session
      const events = await mainRelay.query([{
        kinds: [31997],
        '#d': [sessionId],
        limit: 3,
        since: Math.floor(Date.now() / 1000) - 300 // 5 minutes window
      }], { signal: AbortSignal.timeout(10000) });

      if (events.length === 0) {
        throw new Error('Session not found or expired');
      }

      // Filter for session events and get the newest one
      const sessionEvents = events
        .map(event => ({ event, parsed: parseSessionEvent(event) }))
        .filter(({ parsed }) => parsed?.type === 'session')
        .sort((a, b) => b.event.created_at - a.event.created_at);

      if (sessionEvents.length === 0) {
        throw new Error('Session not found or expired');
      }

      const { parsed } = sessionEvents[0];

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
  }, [user, nostr, config.relayUrl, publishSignal, parseSessionEvent]);

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

    // Clear the bookkeeping for ICE/SDP
    remoteDescSetRef.current.clear();
    pendingRemoteCandidatesRef.current.clear();

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