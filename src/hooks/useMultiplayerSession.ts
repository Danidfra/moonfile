import { useState, useEffect, useRef, useCallback } from 'react';
import { useNostr } from '@jsr/nostrify__react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
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

  /**
   * Generate unique session ID in the format: game:gameId:room:sessionId
   */
  const generateSessionId = (gameId: string): string => {
    const randomId = 'session_' + Math.random().toString(36).substring(2, 15) +
                     Math.random().toString(36).substring(2, 15);
    return `game:${gameId}:room:${randomId}`;
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
        '#d': [sessionId], // sessionId already includes the full format
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
        const [remoteStream] = event.streams;
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
          ['d', sessionId], // sessionId already includes the full format
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
   * Handle incoming guest connections (host only)
   */
  const handleGuestAnswer = useCallback(async (guestPubkey: string, answer: RTCSessionDescriptionInit) => {
    if (!isHost) return;

    try {
      // Create new peer connection for this guest
      const peerConnection = createPeerConnection(guestPubkey);

      // Create new offer for this specific guest
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Set the guest's answer
      await peerConnection.setRemoteDescription(answer);

      // Add guest to connected players
      setConnectedPlayers(prev => [
        ...prev.filter(p => p.pubkey !== guestPubkey),
        { pubkey: guestPubkey, status: 'connecting' }
      ]);

      // Update session with connected guest
      if (user) {
        const currentSession = session;
        if (currentSession) {
          const newConnected = [...currentSession.connected, guestPubkey];
          const newStatus: SessionStatus = newConnected.length + 1 >= currentSession.maxPlayers ? 'full' : 'available';

          publishEvent({
            kind: 31997,
            content: '',
            tags: [
              ['d', sessionId], // sessionId already includes the full format
              ['host', user.pubkey],
              ...currentSession.guests.map(g => ['guest', g]),
              ['guest', guestPubkey],
              ...newConnected.map(g => ['connected', g]),
              ['status', newStatus]
            ]
          });

          setStatus(newStatus);
        }
      }

    } catch (err) {
      console.error('[MultiplayerSession] Failed to handle guest answer:', err);
    }
  }, [isHost, session, sessionId, gameId, user, publishEvent, createPeerConnection]);

  /**
   * Subscribe to session updates
   */
  useEffect(() => {
    if (!sessionId || !nostr) return;

    const subscription = nostr.req([{
      kinds: [31997],
      '#d': [sessionId], // sessionId already includes the full format
      since: Math.floor(Date.now() / 1000) - 60 // Events from last minute
    }], {
      onevent: (event: NostrEvent) => {
        console.log('[MultiplayerSession] Received session update:', event);

        // Parse session data
        const hostTag = event.tags.find(t => t[0] === 'host');
        const playersTag = event.tags.find(t => t[0] === 'players');
        const statusTag = event.tags.find(t => t[0] === 'status');
        const signalTag = event.tags.find(t => t[0] === 'signal');
        const guestTags = event.tags.filter(t => t[0] === 'guest');
        const connectedTags = event.tags.filter(t => t[0] === 'connected');

        if (hostTag && playersTag && statusTag) {
          const sessionData: MultiplayerSession = {
            sessionId,
            gameId,
            hostPubkey: hostTag[1],
            maxPlayers: parseInt(playersTag[1]),
            status: statusTag[1] as SessionStatus,
            guests: guestTags.map(t => t[1]),
            connected: connectedTags.map(t => t[1]),
            signal: signalTag?.[1]
          };

          setSession(sessionData);
          setStatus(sessionData.status);

          // If we're the host and there's a new guest answer, handle it
          if (isHost && user && event.pubkey !== user.pubkey && signalTag) {
            try {
              const signal = JSON.parse(atob(signalTag[1]));
              if (signal.type === 'answer') {
                handleGuestAnswer(event.pubkey, signal);
              }
            } catch (err) {
              console.error('[MultiplayerSession] Failed to parse guest signal:', err);
            }
          }
        }
      },
      oneose: () => {
        console.log('[MultiplayerSession] Session subscription ended');
      }
    });

    return () => {
      if (subscription) {
        subscription.close();
      }
    };
  }, [sessionId, gameId, nostr, isHost, user, handleGuestAnswer]);

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