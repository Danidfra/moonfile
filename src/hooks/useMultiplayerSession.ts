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
  playerIndex?: number; // 1-4 (1=host, 2-4=guests)
}

export interface PeerConnection {
  pubkey: string;
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  chatChannel?: RTCDataChannel;
}

// Constants for event kinds
const KIND_SESSION = 31997;  // replaceable snapshot
const KIND_SIGNAL = 21997;   // ephemeral signaling

/**
 * Session ID helpers to ensure consistent format: "game:gameId:room:roomId"
 */
const ensureGamePrefix = (id: string): string => {
  return id.startsWith('game:') ? id : `game:${id}`;
};

const stripGamePrefix = (id: string): string => {
  return id.startsWith('game:') ? id.slice(5) : id;
};

const buildSessionId = (gameId: string, roomId: string): string => {
  const base = ensureGamePrefix(gameId);
  return `${base}:room:${roomId}`;
};

const parseSessionId = (sessionId: string): { gameId: string; roomId: string } => {
  const [left, roomId = ''] = sessionId.split(':room:');
  const gameId = ensureGamePrefix(stripGamePrefix(left));
  return { gameId, roomId };
};

const generateSessionId = (gameId: string): string => {
  const room = Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
  const base = ensureGamePrefix(gameId);
  return `${base}:room:${room}`;
};

// Type definitions for the new signaling protocol
export type SessionEventType = 'session' | 'join';
export type SignalEventType = 'offer' | 'answer' | 'candidate';

export interface SignalPayload {
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  playerIndex?: number;
}

export interface SignalParsed {
  type: SignalEventType;
  sessionId: string;
  from: string;        // event.pubkey
  to: string | null;   // from 'p' tag
  payload: SignalPayload;
}

export interface ParsedSessionEvent {
  type: SessionEventType;
  sessionId: string;
  from?: string;
  to?: string;
  host?: string;
  players?: string;
  status?: SessionStatus;
  guests?: string[];
  connected?: string[];
}

function waitForIceGatheringComplete(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise<void>((resolve) => {
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', onChange);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', onChange);
  });
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

  // Per-peer subscription controllers: Map<peerKey, AbortController>
  const peerSubscriptionsRef = useRef<Map<string, AbortController>>(new Map());

  // Session subscription controller
  const sessionControllerRef = useRef<AbortController | null>(null);

  // ICE candidate queues until remoteDescription is set
  const iceCandidateQueuesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // For guest: single peer connection to host
  const guestPeerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const guestDataChannelRef = useRef<RTCDataChannel | null>(null);
  const guestChatChannelRef = useRef<RTCDataChannel | null>(null);

  const isStartingRef = useRef(false);
  const hasStartedRef = useRef(false);

  const storageKey = useCallback(
    (pk?: string) => (pk ? `mp:${pk}:${ensureGamePrefix(gameId)}` : ''),
    [gameId]
  );

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
   * Attach/replace host video track on all existing peers
   */
  const attachStreamToAllPeers = useCallback((stream: MediaStream) => {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    peerConnectionsRef.current.forEach(({ connection }) => {
      const tx = connection.getTransceivers().find(t => t.sender?.track?.kind === 'video' || t.receiver?.track?.kind === 'video');
      const sender = tx?.sender ?? connection.getSenders().find(s => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(videoTrack).catch(err => console.error('[HOST] replaceTrack fail:', err));
    });
  }, []);

  /**
   * Publish session state (type=session) to relay
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

    await publishEvent({
      kind: KIND_SESSION,
      content: '',
      tags,
      relays: [config.relayUrl]
    });

    console.log('[SESSION/PUB] Published session state:', updates);
  }, [user, session, publishEvent, config.relayUrl]);

  /**
   * Parse session event according to new protocol
   */
  const parseSessionEvent = useCallback((event: NostrEvent): ParsedSessionEvent | null => {
    const tags = event.tags || [];
    const getTag = (n: string) => tags.find(t => t[0] === n)?.[1];
    const getVals = (n: string) => tags.filter(t => t[0] === n).map(t => t[1]);

    const type = getTag('type') as SessionEventType;
    if (!type || !['session', 'join'].includes(type)) return null;

    return {
      type,
      sessionId: getTag('d') || '',
      from: getTag('from'),
      to: getTag('to'),
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
    const type = event.tags.find(t => t[0] === 'type')?.[1] as SignalEventType;
    const d = event.tags.find(t => t[0] === 'd')?.[1] || '';
    const to = event.tags.find(t => t[0] === 'p')?.[1] || null;

    if (!d || !type || !['offer', 'answer', 'candidate'].includes(type)) return null;

    let payload: SignalPayload = {};
    try {
      payload = JSON.parse(event.content || '{}');
    } catch (e) {
      console.error('[SIG/PARSE] Failed to parse signal content:', e);
      return null;
    }

    return { type, sessionId: d, from: event.pubkey, to, payload };
  }, []);

  /**
   * Generate peer key for subscription management
   */
  const getPeerKey = useCallback(
    (localPk: string, remotePk: string, sidOverride?: string): string => {
      const sid = sidOverride ?? sessionId;
      return `${sid}:${localPk}:${remotePk}`;
    },
    [sessionId]
  );

  /**
   * Publish ephemeral signaling message with robust logging
   */
  const publishSignalEphemeral = useCallback(async (
    to: string,
    type: SignalEventType,
    payload: SignalPayload,
    sidOverride?: string
  ): Promise<void> => {
    const sid = sidOverride ?? sessionId;
    if (!user || !sid) {
      console.warn(`[SIG/PUB] skip (missing user/sid). type=${type} to=${to.substring(0,8)}... sid=${sid}`);
      return;
    }

    try {
      const event = {
        kind: KIND_SIGNAL,
        content: JSON.stringify(payload),
        tags: [
          ['d', sid],
          ['type', type],
          ['p', to],
          ['expiration', String(Math.floor(Date.now() / 1000) + 60)] // 1 minute TTL
        ],
        relays: [config.relayUrl]
      };

      await publishEvent(event);

      // Robust logging as requested
      console.log(`[SIG/PUB] kind=${KIND_SIGNAL} type=${type} d=${sid} to=${to.substring(0, 8)}... ok=true`);
    } catch (error) {
      console.error(`[SIG/PUB] kind=${KIND_SIGNAL} type=${type} d=${sessionId} to=${to.substring(0, 8)}... ok=false error:`, error);
      throw error; // Don't proceed as if published
    }
  }, [user, sessionId, publishEvent, config.relayUrl]);

  /**
   * Handle incoming signaling events
   */
  const handleSignalEvent = useCallback(async (parsed: SignalParsed) => {
    const { type, from, payload } = parsed;

    console.log(`[SIG/RECV] ${type} from ${from.substring(0, 8)}...`);

    try {
      if (isHost) {
        // Host handling guest signals
        const peerData = peerConnectionsRef.current.get(from);
        if (!peerData) {
          console.warn(`[SIG/RECV] No peer connection found for ${from.substring(0, 8)}...`);
          return;
        }

        const pc = peerData.connection;

        if (type === 'answer' && payload.sdp) {
          await pc.setRemoteDescription(payload.sdp);
          console.log(`[SIG/RECV] Remote description set for guest ${from.substring(0, 8)}...`);

          // Flush queued ICE candidates
          const queue = iceCandidateQueuesRef.current.get(from) || [];
          for (const candidate of queue) {
            await pc.addIceCandidate(candidate);
          }
          iceCandidateQueuesRef.current.delete(from);

        } else if (type === 'candidate' && payload.candidate) {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(payload.candidate);
          } else {
            // Queue until remoteDescription is set
            const queue = iceCandidateQueuesRef.current.get(from) || [];
            queue.push(payload.candidate);
            iceCandidateQueuesRef.current.set(from, queue);
          }
        }
      } else {
        // Guest handling host signals
        const pc = guestPeerConnectionRef.current;
        if (!pc) {
          console.warn('[SIG/RECV] No guest peer connection available');
          return;
        }

        if (type === 'offer' && payload.sdp) {
          await pc.setRemoteDescription(payload.sdp);

          // Store player index from offer
          if (payload.playerIndex) {
            console.log(`[GUEST] Received player index: ${payload.playerIndex}`);
            // Store player index for this guest
            localStorage.setItem(`playerIndex_${sessionId}`, payload.playerIndex.toString());
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          await waitForIceGatheringComplete(pc);

          await publishSignalEphemeral(from, 'answer', { sdp: pc.localDescription! }, parsed.sessionId);
          console.log(`[SIG/RECV] Sent answer to host ${from.substring(0, 8)}...`);

          // Flush queued ICE candidates
          const queue = iceCandidateQueuesRef.current.get(from) || [];
          for (const candidate of queue) {
            await pc.addIceCandidate(candidate);
          }
          iceCandidateQueuesRef.current.delete(from);

        } else if (type === 'candidate' && payload.candidate) {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(payload.candidate);
          } else {
            // Queue until remoteDescription is set
            const queue = iceCandidateQueuesRef.current.get(from) || [];
            queue.push(payload.candidate);
            iceCandidateQueuesRef.current.set(from, queue);
          }
        }
      }
    } catch (error) {
      console.error(`[SIG/RECV] Error handling ${type} from ${from.substring(0, 8)}...`, error);
    }
  }, [isHost, publishSignalEphemeral]);

  /**
   * Start per-peer signaling subscription
   */
  const startPeerSignalingSubscription = useCallback((remotePubkey: string, sidOverride?: string) => {
    const sid = sidOverride ?? sessionId;
    if (!user || !sid || !nostr) return;

    const peerKey = getPeerKey(user.pubkey, remotePubkey, sid);
    if (peerSubscriptionsRef.current.has(peerKey)) {
      console.log(`[SIG/SUB] Already subscribed to peer ${remotePubkey.substring(0, 8)}...`);
      return;
    }

    const controller = new AbortController();
    peerSubscriptionsRef.current.set(peerKey, controller);

    (async () => {
      try {
        const relay = nostr.relay(config.relayUrl);
        const filter = {
          kinds: [KIND_SIGNAL],
          '#d': [sid],
          '#p': [user.pubkey],
          authors: [remotePubkey],
          since: Math.floor(Date.now() / 1000) - 2,
        };

        console.log(`[SIG/SUB] Starting per-peer subscription for ${remotePubkey.substring(0, 8)}...`);

        for await (const msg of relay.req([filter], { signal: controller.signal })) {
          if (msg[0] === 'EVENT') {
            const event = msg[2];
            if (processedEventIdsRef.current.has(event.id)) continue;
            processedEventIdsRef.current.add(event.id);

            const parsed = parseSignalEvent(event);
            if (parsed && parsed.to === user.pubkey) {
              await handleSignalEvent(parsed);
            }
          }
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error(`[SIG/SUB] Error in peer subscription for ${remotePubkey.substring(0, 8)}...`, error);
        }
      }
    })();
  }, [user, sessionId, nostr, config.relayUrl, getPeerKey, parseSignalEvent, handleSignalEvent]);

  /**
   * Stop per-peer signaling subscription
   */
  const stopPeerSignalingSubscription = useCallback((remotePubkey: string, sidOverride?: string) => {
    if (!user) return;
    const peerKey = getPeerKey(user.pubkey, remotePubkey, sidOverride);
    const controller = peerSubscriptionsRef.current.get(peerKey);

    if (controller) {
      controller.abort();
      peerSubscriptionsRef.current.delete(peerKey);
      console.log(`[SIG/SUB] Stopped subscription for peer ${remotePubkey.substring(0, 8)}...`);
    }
  }, [user, getPeerKey]);

  /**
   * Create WebRTC peer connection for a specific guest (host side)
   */
  const createHostPeerConnection = useCallback((guestPubkey: string): RTCPeerConnection => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    peerConnection.onnegotiationneeded = () => {};

    // 🔧 sempre crie o transceiver de vídeo (ordem estável das m-lines)
    const vtx = peerConnection.addTransceiver('video', { direction: 'sendonly' });

    // se já tem stream, substitui o track sem renegociação
    const track = hostVideoStreamRef.current?.getVideoTracks?.()[0];
    if (track) {
      vtx.sender.replaceTrack(track).catch(err => console.error('[HOST] replaceTrack fail:', err));
    }

    // DataChannel para inputs
    const dataChannel = peerConnection.createDataChannel('inputs', { ordered: true });
    dataChannel.onopen = () => {
      console.log(`[DataChannel] Opened for guest ${guestPubkey.substring(0, 8)}...`);
    };
    dataChannel.onmessage = (event) => {
      try {
        const input = JSON.parse(event.data);
        console.log(`[DataChannel] Received input from guest ${guestPubkey.substring(0, 8)}...`, input);

        if (input.type === 'input') {
          // avisa o EmulatorIFrame
          window.dispatchEvent(new CustomEvent('remoteInput', { detail: input }));
        }
      } catch (err) {
        console.error('[DataChannel] Failed to parse guest input:', err);
      }
    };

    // DataChannel para chat
    const chatChannel = peerConnection.createDataChannel('chat', { ordered: true });
    chatChannel.onopen = () => {
      console.log(`[ChatDC] Opened for guest ${guestPubkey.substring(0, 8)}...`);
    };
    chatChannel.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.type === 'chat') {
          // rebroadcast para os outros convidados
          peerConnectionsRef.current.forEach((peer, pk) => {
            if (pk !== guestPubkey && peer.chatChannel?.readyState === 'open') {
              peer.chatChannel.send(JSON.stringify(msg));
            }
          });
          // entrega para a UI local
          window.dispatchEvent(new CustomEvent('chat:incoming', { detail: msg }));
        }
      } catch (err) {
        console.error('[ChatDC] parse fail:', err);
      }
    };

    // Sem trickle ICE
    peerConnection.onicecandidate = () => { /* no-op */ };

    // Estado de conexão
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log(`[PeerConnection] State for guest ${guestPubkey.substring(0, 8)}...`, state);

      setConnectedPlayers(prev =>
        prev.map(player =>
          player.pubkey === guestPubkey
            ? { ...player, status: state === 'connected' ? 'connected' as const : 'connecting' as const }
            : player
        )
      );
    };

    // Guarda a conexão
    peerConnectionsRef.current.set(guestPubkey, {
      pubkey: guestPubkey,
      connection: peerConnection,
      dataChannel,
      chatChannel
    });

    return peerConnection;
  }, []);

  /**
   * Create WebRTC peer connection for guest
   */
  const createGuestPeerConnection = useCallback((): RTCPeerConnection => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Handle incoming video stream
    const inbound = new MediaStream();
    peerConnection.ontrack = (event) => {
      console.log('[PeerConnection] Received host video stream');
      try {
        if (!inbound.getTracks().includes(event.track)) {
          inbound.addTrack(event.track);
        }
        // Entrega um único stream consistente pra UI
        window.dispatchEvent(new CustomEvent('hostVideoStream', { detail: inbound }));
      } catch (e) {
        console.warn('[PeerConnection] Failed to build inbound stream', e);
      }
    };

    // Handle data channel from host
    peerConnection.ondatachannel = (event) => {
      const dataChannel = event.channel;
      console.log('[DataChannel] Received from host:', dataChannel.label);

      // Store reference for sending inputs
      if (dataChannel.label === 'inputs') {
        guestDataChannelRef.current = dataChannel;
        dataChannel.onopen = () => console.log('[DataChannel] Guest inputs opened');
        return;
      }
      if (dataChannel.label === 'chat') {
        guestChatChannelRef.current = dataChannel;
        dataChannel.onopen = () => console.log('[DataChannel] Guest chat opened');
        dataChannel.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg?.type === 'chat') {
              window.dispatchEvent(new CustomEvent('chat:incoming', { detail: msg }));
            }
          } catch {}
        };
        return;
      }
    };

    // Handle ICE candidates - need to get host pubkey from session
    peerConnection.onicecandidate = () => { /* no-op: sem trickle */ };

    // Connection state monitoring
    peerConnection.onconnectionstatechange = () => {
      console.log('[PeerConnection] Guest connection state:', peerConnection.connectionState);
    };

    guestPeerConnectionRef.current = peerConnection;
    return peerConnection;
  }, []);

  /**
   * Handle session events (kind 31997)
   */
  const handleSessionEvent = useCallback(async (event: NostrEvent) => {
    if (processedEventIdsRef.current.has(event.id)) return;
    processedEventIdsRef.current.add(event.id);

    const parsed = parseSessionEvent(event);
    if (!parsed || !parsed.sessionId) return;

    console.log('[SESSION] Handling event:', { type: parsed.type, from: parsed.from });

    if (parsed.type === 'session' && parsed.host) {
      // Update session snapshot
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
    } else if (parsed.type === 'join' && isHost && user && parsed.to === user.pubkey && parsed.from) {
      // Host received join request - start per-peer signaling
      const guestPubkey = parsed.from;

      if (peerConnectionsRef.current.has(guestPubkey)) {
        console.warn('[HOST] Duplicate join for', guestPubkey.substring(0, 8), '... ignored');
        return;
      }

      // Check if session is full (max 4 players total: 1 host + 3 guests)
      const currentPlayers = connectedPlayers.length + 1; // +1 for host
      if (currentPlayers >= 4) {
        console.warn('[HOST] Session full (4 players max), rejecting join from', guestPubkey.substring(0, 8), '...');

        // Send session full status
        await publishSessionState(sessionId, {
          status: 'full',
          maxPlayers: 4,
          guests: connectedPlayers.map(p => p.pubkey).concat([guestPubkey]),
          connected: connectedPlayers.filter(p => p.status === 'connected').map(p => p.pubkey)
        });
        return;
      }

      // Assign player index (2, 3, or 4 - 1 is host)
      const existingPlayerIndices = connectedPlayers.map(p => p.playerIndex).filter(Boolean);
      const availablePlayerIndex = [2, 3, 4].find(index => !existingPlayerIndices.includes(index)) || 2;

      // Start per-peer signaling subscription for this guest
      startPeerSignalingSubscription(guestPubkey);

      // Create peer connection
      const pc = createHostPeerConnection(guestPubkey);

      // Add to UI with assigned player index
      setConnectedPlayers(prev => [
        ...prev.filter(p => p.pubkey !== guestPubkey),
        { pubkey: guestPubkey, status: 'connecting' as const, playerIndex: availablePlayerIndex }
      ]);

      try {
        // Create and send offer with player index info
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitForIceGatheringComplete(pc);
        await publishSignalEphemeral(guestPubkey, 'offer', {
          sdp: pc.localDescription!,
          playerIndex: availablePlayerIndex
        }, sessionId);

        console.log(`[HOST] Offer sent to guest ${guestPubkey.substring(0, 8)}... as Player ${availablePlayerIndex}`);
      } catch (error) {
        console.error(`[HOST] Failed to create/send offer to ${guestPubkey.substring(0, 8)}...`, error);
      }
    }
  }, [parseSessionEvent, isHost, user, gameId, startPeerSignalingSubscription, createHostPeerConnection, publishSignalEphemeral]);

  /**
   * Start session subscription (for join events and session snapshots)
   */
  const startSessionSubscription = useCallback(async () => {
    if (!sessionId || !nostr || !user) return;

    // Abort existing session subscription
    if (sessionControllerRef.current) {
      sessionControllerRef.current.abort();
    }

    const controller = new AbortController();
    sessionControllerRef.current = controller;

    try {
      const relay = nostr.relay(config.relayUrl);

      console.log(`[SESSION/SUB] Starting for session ${sessionId}`);

      for await (const msg of relay.req([{
        kinds: [KIND_SESSION],
        '#d': [sessionId],
        since: Math.floor(Date.now() / 1000) - 2 // Small cushion
      }], { signal: controller.signal })) {

        if (msg[0] === 'EVENT') {
          await handleSessionEvent(msg[2]);
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('[SESSION/SUB] Error:', error);
      }
    }
  }, [sessionId, nostr, user, config.relayUrl, handleSessionEvent]);

  /**
   * Start multiplayer session as host
   */
  const startSession = useCallback(async (videoStream: MediaStream, maxPlayers: number = 2) => {
    if (!user) {
      setError('Must be logged in to start session');
      return;
    }

    if (hasStartedRef.current || isStartingRef.current) {
      console.warn('[HOST] startSession ignored (already starting/started).');
      return;
    }
    isStartingRef.current = true;

    try {
      setError(null);

      if (sessionId && (status === 'creating' || status === 'available')) {
        console.log('[HOST] Reusing in-memory session:', sessionId);
        hostVideoStreamRef.current = videoStream;
        attachStreamToAllPeers(videoStream);
        await publishSessionState(sessionId, {
          status: 'available',
          maxPlayers,
          guests: [],
          connected: []
        });
        hasStartedRef.current = true;
        isStartingRef.current = false;
        return;
      }

      const saved = sessionStorage.getItem(storageKey(user.pubkey));
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed?.sessionId && parsed?.owner === user.pubkey) {
            setSessionId(parsed.sessionId);
            setIsHost(true);
            hostVideoStreamRef.current = videoStream;
            attachStreamToAllPeers(videoStream);
            setStatus('available');
            console.log('[HOST] Reattached to existing session:', parsed.sessionId);
            await publishSessionState(parsed.sessionId, {
              status: 'available',
              maxPlayers,
              guests: [],
              connected: []
            });
            hasStartedRef.current = true;
            isStartingRef.current = false;
            return;
          }
        } catch { /* ignore JSON error */ }
      }

      setStatus('creating');

      const newSessionId = generateSessionId(gameId);
      setSessionId(newSessionId);
      setIsHost(true);

      sessionStorage.setItem(storageKey(user.pubkey), JSON.stringify({
        owner: user.pubkey,
        sessionId: newSessionId
      }));

      hostVideoStreamRef.current = videoStream;
      attachStreamToAllPeers(videoStream);

      await publishSessionState(newSessionId, {
        status: 'available',
        maxPlayers,
        guests: [],
        connected: []
      });

      setStatus('available');
      hasStartedRef.current = true;
      console.log('[HOST] Session started:', newSessionId);
    } catch (err) {
      console.error('[HOST] Failed to start session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setStatus('error');
      hasStartedRef.current = false;
    } finally {
      isStartingRef.current = false;
    }
  }, [user, gameId, sessionId, status, publishSessionState, storageKey]);

  /**
   * Join existing session as guest
   */
  const joinSession = useCallback(async (sessionIdToJoin: string) => {
    if (!user) {
      setError('Must be logged in to join session');
      return;
    }

    try {
      setStatus('creating');
      setError(null);
      setSessionId(sessionIdToJoin);
      setIsHost(false);

      // Query latest session state to get host pubkey
      const relay = nostr.relay(config.relayUrl);
      const events = await relay.query([{
        kinds: [KIND_SESSION],
        '#d': [sessionIdToJoin],
        limit: 1
      }], { signal: AbortSignal.timeout(10000) });

      if (events.length === 0) {
        throw new Error('Session not found');
      }

      const sessionEvent = events[0];
      const parsed = parseSessionEvent(sessionEvent);

      if (!parsed || parsed.type !== 'session' || !parsed.host) {
        throw new Error('Invalid session data');
      }

      if (parsed.status === 'full') {
        throw new Error('Session is full');
      }

      const hostPubkey = parsed.host;

      // Start per-peer signaling subscription BEFORE sending join
      startPeerSignalingSubscription(hostPubkey, sessionIdToJoin);

      // Create guest peer connection
      createGuestPeerConnection();

      // Send join request
      await publishEvent({
        kind: KIND_SESSION,
        content: '',
        tags: [
          ['d', sessionIdToJoin],
          ['type', 'join'],
          ['from', user.pubkey],
          ['to', hostPubkey]
        ],
        relays: [config.relayUrl]
      });

      setStatus('available');
      console.log(`[GUEST] Join request sent to host ${hostPubkey.substring(0, 8)}...`);

    } catch (err) {
      console.error('[GUEST] Failed to join session:', err);
      setError(err instanceof Error ? err.message : 'Failed to join session');
      setStatus('error');
    }
  }, [user, nostr, config.relayUrl, parseSessionEvent, startPeerSignalingSubscription, createGuestPeerConnection, publishEvent]);

  /**
   * Subscribe to session updates
   */
  useEffect(() => {
    if (!sessionId) return;

    startSessionSubscription();

    return () => {
      // Cleanup session subscription
      if (sessionControllerRef.current) {
        sessionControllerRef.current.abort();
        sessionControllerRef.current = null;
      }
    };
  }, [sessionId, startSessionSubscription]);

  /**
   * Leave session and cleanup
   */
  const leaveSession = useCallback(() => {
    // Close all peer connections (host)
    peerConnectionsRef.current.forEach(({ connection }) => {
      connection.close();
    });
    peerConnectionsRef.current.clear();

    // Close guest peer connection
    if (guestPeerConnectionRef.current) {
      guestPeerConnectionRef.current.close();
      guestPeerConnectionRef.current = null;
    }

    // Close guest data channel
    if (guestDataChannelRef.current) {
      guestDataChannelRef.current.close();
      guestDataChannelRef.current = null;
    }

    // Close guest chat channel
    if (guestChatChannelRef.current) {
      guestChatChannelRef.current.close();
      guestChatChannelRef.current = null;
    }

    // Stop video tracks
    if (hostVideoStreamRef.current) {
      hostVideoStreamRef.current.getTracks().forEach(track => track.stop());
      hostVideoStreamRef.current = null;
    }

    // Abort all subscriptions
    if (sessionControllerRef.current) {
      sessionControllerRef.current.abort();
      sessionControllerRef.current = null;
    }

    // Abort all per-peer subscriptions
    peerSubscriptionsRef.current.forEach(controller => controller.abort());
    peerSubscriptionsRef.current.clear();

    // Reset state
    setSessionId('');
    setSession(null);
    setIsHost(false);
    setStatus('idle');
    setConnectedPlayers([]);
    setError(null);
    processedEventIdsRef.current.clear();
    iceCandidateQueuesRef.current.clear();

    console.log('[SESSION] Left and cleaned up');
    if (user?.pubkey) {
      sessionStorage.removeItem(storageKey(user.pubkey));
    }
    hasStartedRef.current = false;
    isStartingRef.current = false;

    console.log('[SESSION] Left and cleaned up');
  }, [user, storageKey]);

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
    if (isHost || !guestDataChannelRef.current) return;

    // Get player index from localStorage
    const playerIndex = parseInt(localStorage.getItem(`playerIndex_${sessionId}`) || '2');

    if (guestDataChannelRef.current.readyState === 'open') {
      guestDataChannelRef.current.send(JSON.stringify({
        type: 'input',
        timestamp: Date.now(),
        player: playerIndex,
        ...inputData
      }));
      console.log(`[GUEST] Sent input (Player ${playerIndex}):`, inputData);
    }
  }, [isHost, sessionId]);


  /**
   * Chat: host broadcasts via per-peer chatChannel; guest uses guestChatChannelRef
   */
  const sendChatMessage = useCallback((text: string) => {
    const t = (text || '').trim();
    if (!t) return;
    const msg = { type: 'chat', text: t, from: user?.pubkey, ts: Date.now() };
    if (isHost) {
      peerConnectionsRef.current.forEach(({ chatChannel }) => {
        if (chatChannel?.readyState === 'open') {
          chatChannel.send(JSON.stringify(msg));
        }
      });
      // echo local
      window.dispatchEvent(new CustomEvent('chat:incoming', { detail: msg }));
    } else {
      const dc = guestChatChannelRef.current;
      if (dc?.readyState === 'open') {
        dc.send(JSON.stringify(msg));
        // echo local
        window.dispatchEvent(new CustomEvent('chat:incoming', { detail: msg }));
      }
    }
  }, [isHost, user?.pubkey]);

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
    sendGameInput,
    sendChatMessage
  };
}