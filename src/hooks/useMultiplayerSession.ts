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
  signal?: string;
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

  // Track if session subscription is already active to prevent multiple subscriptions
  const sessionSubscribedRef = useRef(false);

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
   * Stable parse session data function using useRef
   */
  const parseSessionDataRef = useRef<(event: NostrEvent, currentSessionId: string, currentGameId: string) => MultiplayerSession | null>();

  parseSessionDataRef.current = (event: NostrEvent, currentSessionId: string, currentGameId: string): MultiplayerSession | null => {
    const hostTag = event.tags.find(t => t[0] === 'host');
    const playersTag = event.tags.find(t => t[0] === 'players');
    const statusTag = event.tags.find(t => t[0] === 'status');
    const signalTag = event.tags.find(t => t[0] === 'signal');
    const guestTags = event.tags.filter(t => t[0] === 'guest');
    const connectedTags = event.tags.filter(t => t[0] === 'connected');

    if (hostTag && playersTag && statusTag) {
      return {
        sessionId: currentSessionId,
        gameId: currentGameId,
        hostPubkey: hostTag[1],
        maxPlayers: parseInt(playersTag[1]),
        status: statusTag[1] as SessionStatus,
        guests: guestTags.map(t => t[1]),
        connected: connectedTags.map(t => t[1]),
        signal: signalTag?.[1]
      };
    }

    return null;
  };

  /**
   * Create WebRTC peer connection
   */
  const createPeerConnection = useCallback((guestPubkey?: string): RTCPeerConnection => {
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

    // Create data channel for game input
    if (isHost && guestPubkey) {
      const dataChannel = peerConnection.createDataChannel('gameInput', {
        ordered: true
      });

      dataChannel.onopen = () => {
        console.log('[MultiplayerSession] Data channel opened for guest:', guestPubkey);
      };

      dataChannel.onmessage = (event) => {
        console.log('[MultiplayerSession] Received game input:', event.data);
        // Handle game input from guest
      };

      // Store the peer connection
      peerConnectionsRef.current.set(guestPubkey, {
        pubkey: guestPubkey,
        connection: peerConnection,
        dataChannel
      });
    }

    peerConnection.onconnectionstatechange = () => {
      console.log('[MultiplayerSession] Connection state:', peerConnection.connectionState);

      if (guestPubkey) {
        setConnectedPlayers(prev =>
          prev.map(player =>
            player.pubkey === guestPubkey
              ? { ...player, status: peerConnection.connectionState === 'connected' ? 'connected' : 'connecting' }
              : player
          )
        );
      }
    };

    return peerConnection;
  }, [isHost]);



  /**
   * Unified subscription for all session events - handles session updates and guest responses
   * This is the ONLY subscription handler for kind 31997 events
   */
  const startUnifiedSessionSubscription = useCallback((sessionIdToSubscribe: string, abortController: AbortController) => {
    if (!nostr || !config) {
      console.error('[MultiplayerSession] Cannot start session subscription - nostr or config not available');
      return;
    }

    if (sessionSubscribedRef.current) {
      console.warn('[MultiplayerSession] Subscription already active for session:', sessionIdToSubscribe);
      return;
    }

    console.log('[MultiplayerSession] Starting unified session subscription for:', sessionIdToSubscribe);

    // Use only the main relay for session subscription
    const mainRelay = nostr.relay(config.relayUrl);

    // Async function to handle subscription
    const handleSubscription = async () => {
      try {
        console.log('[MultiplayerSession] Starting unified session subscription for:', sessionIdToSubscribe);

        // Use async-iterable pattern for single subscription
        for await (const ev of mainRelay.req([{
          kinds: [31997],
          '#d': [sessionIdToSubscribe],
          since: Math.floor(Date.now() / 1000) - 60 // Events from last minute
        }], { signal: abortController.signal })) {
          if (ev[0] === 'EVENT') {
            const event = ev[2];
            console.log('[MultiplayerSession] Received session event:', event);

            // Parse session data using current values
            const { gameId: currentGameId, isHost: currentIsHost, user: currentUser } = currentValuesRef.current;
            const sessionData = parseSessionDataRef.current?.(event, sessionIdToSubscribe, currentGameId);

            if (sessionData) {
              setSession(sessionData);
              setStatus(sessionData.status);

              // Handle guest responses if we're the host
              if (currentIsHost && currentUser && event.pubkey !== currentUser.pubkey && sessionData.signal) {
                console.log('[MultiplayerSession] Detected potential guest response from:', event.pubkey);

                try {
                  const parsed = JSON.parse(atob(sessionData.signal));
                  if (parsed.type === 'answer') {
                    console.log('[MultiplayerSession] Processing guest answer from:', event.pubkey);

                    // Handle guest answer inline within the unified subscription
                    try {
                      console.log('[MultiplayerSession] Handling guest answer from:', event.pubkey);

                      // Create new peer connection for this guest
                      const peerConnection = createPeerConnection(event.pubkey);

                      // Create new offer for this specific guest
                      const offer = await peerConnection.createOffer();
                      await peerConnection.setLocalDescription(offer);

                      // Set the guest's answer
                      await peerConnection.setRemoteDescription(parsed);

                      // Add guest to connected players
                      setConnectedPlayers(prev => [
                        ...prev.filter(p => p.pubkey !== event.pubkey),
                        { pubkey: event.pubkey, status: 'connecting' }
                      ]);

                      // Get current session data from current values
                      const { session: currentSession, sessionId: currentSessionId } = currentValuesRef.current;
                      if (currentSession) {
                        // Deduplicate guest and connected lists
                        const existingGuests = currentSession.guests || [];
                        const existingConnected = currentSession.connected || [];

                        // Only add guest if not already present
                        const updatedGuests = existingGuests.includes(event.pubkey)
                          ? existingGuests
                          : [...existingGuests, event.pubkey];

                        // Only add to connected if not already present
                        const updatedConnected = existingConnected.includes(event.pubkey)
                          ? existingConnected
                          : [...existingConnected, event.pubkey];

                        const newStatus: SessionStatus = updatedConnected.length + 1 >= currentSession.maxPlayers ? 'full' : 'available';

                        console.log('[MultiplayerSession] Publishing session update with new connected guest:', event.pubkey);

                        // Publish updated session event with explicit created_at
                        publishEvent({
                          kind: 31997,
                          content: '',
                          created_at: Math.floor(Date.now() / 1000),
                          tags: [
                            ['d', currentSessionId],
                            ['host', currentUser.pubkey],
                            ['players', currentSession.maxPlayers.toString()],
                            ...updatedGuests.map(g => ['guest', g]),
                            ...updatedConnected.map(g => ['connected', g]),
                            ['status', newStatus]
                          ]
                        });

                        // Update local session state immediately
                        const updatedSession: MultiplayerSession = {
                          ...currentSession,
                          guests: updatedGuests,
                          connected: updatedConnected,
                          status: newStatus
                        };

                        setSession(updatedSession);
                        setStatus(newStatus);
                      }

                    } catch (guestErr) {
                      console.error('[MultiplayerSession] Failed to handle guest answer:', guestErr);
                    }
                  }
                } catch (err) {
                  console.error('[MultiplayerSession] Failed to parse guest signal:', err);
                }
              }
            }
          } else if (ev[0] === 'EOSE') {
            console.log('[MultiplayerSession] Session subscription ended');
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('[MultiplayerSession] Session subscription aborted');
        } else {
          console.error('[MultiplayerSession] Session subscription error:', err);
        }
      }
    };

    handleSubscription();

    console.log('[MultiplayerSession] Unified session subscription started successfully');
  }, [nostr, config]);


  /**
   * Generate unique session ID in the format: game:gameId:room:sessionId
   */
  const generateSessionId = (gameId: string): string => {
    const randomId = 'session_' + Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    // gameId already includes "game:" prefix from the d tag
    // Just append :room:sessionId to it
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

      // Create initial offer (will be updated for each guest)
      const peerConnection = createPeerConnection();
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Publish initial session event
      publishEvent({
        kind: 31997,
        content: '',
        tags: [
          ['d', newSessionId],
          ['host', user.pubkey],
          ['players', maxPlayers.toString()],
          ['status', 'available'],
          ['signal', btoa(JSON.stringify(offer))]
        ]
      });

      setStatus('available');
      console.log('[MultiplayerSession] Session started:', newSessionId);

    } catch (err) {
      console.error('[MultiplayerSession] Failed to start session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setStatus('error');
    }
  }, [user, gameId, publishEvent, createPeerConnection]);

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

      // Fetch session event
      const events = await nostr.query([{
        kinds: [31997],
        '#d': [sessionId],
        limit: 1
      }], { signal: AbortSignal.timeout(10000) });

      if (events.length === 0) {
        throw new Error('Session not found');
      }

      const sessionEvent = events[0] as NostrEvent;
      const hostPubkey = sessionEvent.tags.find(t => t[0] === 'host')?.[1];
      const signalTag = sessionEvent.tags.find(t => t[0] === 'signal');

      if (!hostPubkey || !signalTag) {
        throw new Error('Invalid session data');
      }

      // Parse the host's offer
      const offer = JSON.parse(atob(signalTag[1]));

      // Create peer connection and answer
      const peerConnection = createPeerConnection();
      await peerConnection.setRemoteDescription(offer);

      // Set up ontrack to receive host's video stream
      peerConnection.ontrack = (event) => {
        console.log('[MultiplayerSession] Received remote stream');
        const [_remoteStream] = event.streams;
        // This will be handled by the component that calls this hook
        // The component should provide a callback or ref
      };

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // Publish answer to join the session
      publishEvent({
        kind: 31997,
        content: '',
        tags: [
          ['d', sessionId],
          ['host', hostPubkey],
          ['guest', user.pubkey],
          ['signal', btoa(JSON.stringify(answer))]
        ]
      });

      setSessionId(sessionId);
      setIsHost(false);
      setStatus('available');
      console.log('[MultiplayerSession] Joined session:', sessionId);

    } catch (err) {
      console.error('[MultiplayerSession] Failed to join session:', err);
      setError(err instanceof Error ? err.message : 'Failed to join session');
      setStatus('error');
    }
  }, [user, gameId, nostr, publishEvent, createPeerConnection]);

  /**
   * Subscribe to session updates - ensures only one subscription per sessionId
   */
  useEffect(() => {
    if (!sessionId || !nostr || sessionSubscribedRef.current) return;

    console.log('[MultiplayerSession] Initializing session subscription for:', sessionId);

    // Create AbortController for subscription cancellation
    const controller = new AbortController();

    // Start unified session subscription (handles all session events and guest responses)
    startUnifiedSessionSubscription(sessionId, controller);
    sessionSubscribedRef.current = true;

    return () => {
      console.log('[MultiplayerSession] Cleaning up unified session subscription for:', sessionId);
      controller.abort();
      sessionSubscribedRef.current = false;
    };
  }, [sessionId, startUnifiedSessionSubscription]);

  /**
   * Leave session
   */
  const leaveSession = useCallback(() => {
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

    // Reset subscription tracking
    sessionSubscribedRef.current = false;
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
  const sendGameInput = useCallback((inputData: any) => {
    if (isHost) return; // Only guests send input

    // Find the host connection (guests only have one connection)
    const connections = Array.from(peerConnectionsRef.current.values());
    if (connections.length > 0) {
      const dataChannel = connections[0].dataChannel;
      if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({
          type: 'input',
          timestamp: Date.now(),
          data: inputData
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