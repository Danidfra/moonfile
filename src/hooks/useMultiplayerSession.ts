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

// Constants for event kinds
const KIND_SESSION = 31997;  // replaceable snapshot
const KIND_SIGNAL = 21997;   // ephemeral signaling

// Type definitions for the new signaling protocol
export type SignalEventType = 'session' | 'join' | 'offer' | 'answer' | 'candidate';

export interface SignalPayload {
  type: 'offer' | 'answer' | 'candidate';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export type SignalParsed = {
  type: 'offer' | 'answer' | 'candidate';
  sessionId: string;
  from: string;        // event.pubkey
  to: string | null;   // from 'p' tag
  payload: {
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  };
};

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
  const signalingSubscribedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const signalingAbortControllerRef = useRef<AbortController | null>(null);

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

    return {
      type,
      sessionId: getTag('d') || '',
      from: getTag('from'),
      to: getTag('to'),
      signal: undefined, // No longer used for signaling
      host: getTag('host'),
      players: getTag('players'),
      status: getTag('status') as SessionStatus,
      guests: getVals('guest'),
      connected: getVals('connected'),
    };
  }, []);

  /**
   * Parse ephemeral signaling event
   */
  const parseSignalEvent = useCallback((event: NostrEvent): SignalParsed | null => {
    const type = event.tags.find(t => t[0] === 'type')?.[1] as 'offer' | 'answer' | 'candidate';
    const d = event.tags.find(t => t[0] === 'd')?.[1] || '';
    const to = event.tags.find(t => t[0] === 'p')?.[1] || null;

    if (!d || !type) return null;

    let payload: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit } = {};
    try {
      payload = JSON.parse(event.content || '{}');
    } catch (e) {
      console.error('[SIG/PARSE] Failed to parse signal content:', e);
      return null;
    }

    return { type, sessionId: d, from: event.pubkey, to, payload };
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
      kind: KIND_SESSION,
      content: '',
      tags,
      relays: [config.relayUrl]
    });
  }, [user, session, publishEvent, config.relayUrl]);

  /**
   * Publish ephemeral signaling message
   */
  const publishSignalEphemeral = useCallback(async (
    to: string,
    type: 'offer' | 'answer' | 'candidate',
    payload: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }
  ) => {
    if (!user || !sessionId) return;

    console.log('[SIG/PUB] ->', { type, to, sessionId, mode: 'ephemeral' });

    try {
      await publishEvent({
        kind: KIND_SIGNAL,
        content: JSON.stringify(payload),
        tags: [
          ['d', sessionId],
          ['type', type],
          ['p', to],
          ['expiration', String(Math.floor(Date.now() / 1000) + 60)] // 1 minute TTL
        ],
        relays: [config.relayUrl]
      });
      console.log('[SIG/OK]', type, '->', to, 'mode=ephemeral');
    } catch (e) {
      console.error('[SIG/ERR]', type, e);
    }
  }, [user, sessionId, publishEvent, config.relayUrl]);

  /**
   * Publish join intent (still uses replaceable events)
   */
  const publishJoin = useCallback(async (hostPubkey: string) => {
    if (!user || !sessionId) return;

    console.log('[JOIN/PUB] ->', { sessionId, to: hostPubkey });

    try {
      await publishEvent({
        kind: KIND_SESSION,
        content: '',
        tags: [
          ['d', sessionId],
          ['type', 'join'],
          ['from', user.pubkey],
          ['to', hostPubkey]
        ],
        relays: [config.relayUrl]
      });
      console.log('[JOIN/OK] ->', hostPubkey);
    } catch (e) {
      console.error('[JOIN/ERR]', e);
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
        publishSignalEphemeral(guestPubkey, 'candidate', { candidate: event.candidate });
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
  }, [publishSignalEphemeral, publishSessionState]);



  /**
   * Unified subscription handler for all session events
   */
const handleSessionEvent = useCallback(async (event: NostrEvent) => {
  if (processedEventIdsRef.current.has(event.id)) return;
  processedEventIdsRef.current.add(event.id);

  const parsed = parseSessionEvent(event);
  if (!parsed || !parsed.sessionId) return;

  console.log('[SESSION] Handling event:', { id: event.id, parsed });

  const { user: currentUser, isHost: currentIsHost } = currentValuesRef.current;

  // 1) Session snapshot updates
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

  // 2) Host-only: react to 'join' (kick off signaling via ephemeral event)
  if (currentIsHost && currentUser && parsed.type === 'join') {
    if (parsed.from && parsed.to === currentUser.pubkey) {
      if (!peerConnectionsRef.current.get(parsed.from)) {
        console.log('[HOST] Guest joined:', parsed.from);

        // Create peer connection for this guest
        const pc = createPeerConnection(parsed.from);
        const from = parsed.from as string;

        // Track UI state
        setConnectedPlayers(prev => [
          ...prev.filter(p => p.pubkey !== from),
          { pubkey: from, status: 'connecting' }
        ]);

        try {
          // Create offer and send via ephemeral signaling
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await publishSignalEphemeral(parsed.from, 'offer', { sdp: offer });
          console.log('[HOST] OFFER sent ->', parsed.from);

          // Update snapshot to include the guest
          await publishSessionState(currentValuesRef.current.sessionId, {
            status: 'available',
            guests: [ ...(session?.guests ?? []), parsed.from ],
            connected: [ ...(session?.connected ?? []) ],
          });
        } catch (err) {
          console.error('[HOST] Failed to create/send offer:', err);
        }
      }
    }
  }

  // Guests do nothing else here; signaling handled in handleSignalEvent
}, [
  parseSessionEvent,
  createPeerConnection,
  publishSignalEphemeral,
  publishSessionState,
  session,
  gameId
]);

  /**
   * Handle ephemeral signaling events (kind 21997)
   */
  const handleSignalEvent = useCallback(async (event: NostrEvent) => {
    if (processedEventIdsRef.current.has(event.id)) {
      return; // Skip already processed events
    }
    processedEventIdsRef.current.add(event.id);

    const parsed = parseSignalEvent(event);
    if (!parsed || !parsed.sessionId) {
      return;
    }

    console.log('[SIGNAL] Handling event:', { type: parsed.type, from: parsed.from });

    const { user: currentUser, isHost: currentIsHost } = currentValuesRef.current;

    // Host-side signaling
    if (currentIsHost && currentUser) {
      switch (parsed.type) {
        case 'answer': {
          console.log('[HOST] Received answer from:', parsed.from);
          const peer = peerConnectionsRef.current.get(parsed.from);
          if (peer && parsed.payload?.sdp) {
            try {
              await peer.connection.setRemoteDescription(parsed.payload.sdp);

              // mark that remote SDP is set
              remoteDescSetRef.current.set(parsed.from, true);

              // flush queued remote candidates (if any)
              const queued = pendingRemoteCandidatesRef.current.get(parsed.from) || [];
              for (const cand of queued) {
                try {
                  await peer.connection.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {
                  console.warn('[HOST] Failed to add queued candidate:', e);
                }
              }
              pendingRemoteCandidatesRef.current.delete(parsed.from);

            } catch (err) {
              console.error('[HOST] Failed to set remote answer:', err);
            }
          }
          break;
        }

        case 'candidate': {
          const hostPeer = peerConnectionsRef.current.get(parsed.from);
          if (hostPeer && parsed.payload?.candidate) {
            try {
              const cand: RTCIceCandidateInit = parsed.payload.candidate;

              // if remote SDP not set yet, queue
              if (!remoteDescSetRef.current.get(parsed.from) || !hostPeer.connection.remoteDescription) {
                const q = pendingRemoteCandidatesRef.current.get(parsed.from) || [];
                q.push(cand);
                pendingRemoteCandidatesRef.current.set(parsed.from, q);
                return;
              }

              await hostPeer.connection.addIceCandidate(new RTCIceCandidate(cand));
            } catch (err) {
              console.error('[HOST] Failed to add ICE candidate:', err);
            }
          }
          break;
        }
      }
    }

    // Guest-side signaling
    if (!currentIsHost && currentUser) {
      switch (parsed.type) {
        case 'offer': {
          console.log('[GUEST] Received offer from host');

          // Create peer connection for host
          const peerConnection = createPeerConnection(parsed.from);

          try {
            if (parsed.payload?.sdp) {
              await peerConnection.setRemoteDescription(parsed.payload.sdp);

              const answer = await peerConnection.createAnswer();
              await peerConnection.setLocalDescription(answer);
              await publishSignalEphemeral(parsed.from, 'answer', { sdp: answer });

              // mark that remote SDP is set (for guest)
              remoteDescSetRef.current.set(parsed.from, true);

              // flush queued remote candidates (if any)
              const queued = pendingRemoteCandidatesRef.current.get(parsed.from) || [];
              for (const cand of queued) {
                try {
                  await peerConnection.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {
                  console.warn('[GUEST] Failed to add queued candidate:', e);
                }
              }
              pendingRemoteCandidatesRef.current.delete(parsed.from);
            }
          } catch (err) {
            console.error('[GUEST] Failed to handle offer:', err);
          }
          break;
        }

        case 'candidate': {
          const guestPeer = peerConnectionsRef.current.get(parsed.from);
          if (guestPeer && parsed.payload?.candidate) {
            try {
              const cand: RTCIceCandidateInit = parsed.payload.candidate;

              // if remote SDP not set yet, queue
              if (!remoteDescSetRef.current.get(parsed.from) || !guestPeer.connection.remoteDescription) {
                const q = pendingRemoteCandidatesRef.current.get(parsed.from) || [];
                q.push(cand);
                pendingRemoteCandidatesRef.current.set(parsed.from, q);
                return;
              }

              await guestPeer.connection.addIceCandidate(new RTCIceCandidate(cand));
            } catch (err) {
              console.error('[GUEST] Failed to add ICE candidate:', err);
            }
          }
          break;
        }
        default:
          break;
      }
    }
  }, [parseSignalEvent, createPeerConnection, publishSignalEphemeral]);

  /**
   * Start ephemeral signaling subscription
   */
  const startSignalingSubscription = useCallback((userPubkey: string) => {
    if (!nostr || !config || !sessionId || signalingSubscribedRef.current) {
      return;
    }

    console.log('[SIGNAL] Starting signaling subscription for:', userPubkey);
    signalingSubscribedRef.current = true;

    // Create new AbortController for signaling subscription
    signalingAbortControllerRef.current = new AbortController();

    const mainRelay = nostr.relay(config.relayUrl);

    const handleSignalingSubscription = async () => {
      try {
        for await (const ev of mainRelay.req([{
          kinds: [KIND_SIGNAL],
          '#d': [sessionId],
          '#p': [userPubkey],
          since: Math.floor(Date.now() / 1000)
        }], { signal: signalingAbortControllerRef.current!.signal })) {
          if (ev[0] === 'EVENT') {
            const event = ev[2];
            handleSignalEvent(event);
          } else if (ev[0] === 'EOSE') {
            console.log('[SIGNAL] Signaling subscription EOSE');
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('[SIGNAL] Signaling subscription aborted');
        } else {
          console.error('[SIGNAL] Signaling subscription error:', err);
        }
        signalingSubscribedRef.current = false;
      }
    };

    handleSignalingSubscription();
  }, [nostr, config, sessionId, handleSignalEvent]);

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
          kinds: [KIND_SESSION],
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
        kinds: [KIND_SESSION],
        '#d': [sessionId],
        limit: 3,
        since: Math.floor(Date.now() / 1000) - 3 // 3 s window
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
      await publishJoin(parsed.host);

      setStatus('available');
      console.log('[MultiplayerSession] Joined session:', sessionId);

    } catch (err) {
      console.error('[MultiplayerSession] Failed to join session:', err);
      setError(err instanceof Error ? err.message : 'Failed to join session');
      setStatus('error');
    }
  }, [user, nostr, config.relayUrl, publishJoin, parseSessionEvent]);

  /**
   * Subscribe to session updates
   */
  useEffect(() => {
    if (!sessionId || !nostr || sessionSubscribedRef.current) return;

    console.log('[MultiplayerSession] Initializing session subscription for:', sessionId);
    startUnifiedSessionSubscription(sessionId);

    return () => {
      console.log('[MultiplayerSession] Cleaning up subscriptions for:', sessionId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (signalingAbortControllerRef.current) {
        signalingAbortControllerRef.current.abort();
        signalingAbortControllerRef.current = null;
      }
      sessionSubscribedRef.current = false;
      signalingSubscribedRef.current = false;
      processedEventIdsRef.current.clear();
    };
  }, [sessionId, startUnifiedSessionSubscription]);

  /**
   * Start signaling subscription when user is set and session is active
   */
  useEffect(() => {
    if (!user || !sessionId || !nostr || signalingSubscribedRef.current) return;

    // Start signaling subscription for this user
    startSignalingSubscription(user.pubkey);

    return () => {
      if (signalingAbortControllerRef.current) {
        signalingAbortControllerRef.current.abort();
        signalingAbortControllerRef.current = null;
      }
      signalingSubscribedRef.current = false;
    };
  }, [user, sessionId, nostr, startSignalingSubscription]);

  /**
   * Leave session
   */
  const leaveSession = useCallback(() => {
    // Abort any ongoing subscriptions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (signalingAbortControllerRef.current) {
      signalingAbortControllerRef.current.abort();
      signalingAbortControllerRef.current = null;
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
    signalingSubscribedRef.current = false;
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