/**
 * Multiplayer Guest Room Page
 *
 * For guests joining multiplayer sessions. Uses a video element instead of NesPlayer
 * to receive the host's game stream via WebRTC. Maintains visual consistency with
 * the host room while providing a spectator/guest experience.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useNostr } from '@jsr/nostrify__react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, Users, Wifi, WifiOff, Play } from 'lucide-react';
import MultiplayerChat from '@/components/MultiplayerChat';
import GameControls from '@/components/GameControls';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useAuthor } from '@/hooks/useAuthor';
import { useAppContext } from '@/hooks/useAppContext';
import { genUserName } from '@/lib/genUserName';

import type { NostrEvent } from '@jsr/nostrify__nostrify';
import type { SessionStatus } from '@/hooks/useMultiplayerSession';

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

const parseSessionId = (sessionId: string): { gameId: string; roomId: string } => {
  const [left, roomId = ''] = sessionId.split(':room:');
  const gameId = ensureGamePrefix(stripGamePrefix(left));
  return { gameId, roomId };
};

const waitForIceGatheringComplete = (pc: RTCPeerConnection) => {
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

type ConnectionState = 'connecting' | 'connected' | 'receiving' | 'error' | 'disconnected';

interface GameMetadata {
  id: string;
  title: string;
  summary?: string;
  genres: string[];
  modes: string[];
  status?: string;
  version?: string;
  credits?: string;
  platforms: string[];
  assets: {
    cover?: string;
    icon?: string;
    banner?: string;
    screenshots: string[];
  };
}

export default function MultiplayerGuestRoom() {
  const { sessionId: raw } = useParams<{ sessionId: string }>();
  const sessionId = raw ? decodeURIComponent(raw) : '';
  const navigate = useNavigate();
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutate: publishEvent } = useNostrPublish();
  const { config } = useAppContext();
  const videoRef = useRef<HTMLVideoElement>(null);

  // State management
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [gameMeta, setGameMeta] = useState<GameMetadata | null>(null);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [connectedPlayers, setConnectedPlayers] = useState(0);
  const [hostPubkey, setHostPubkey] = useState<string>('');
  const [gameId, setGameId] = useState<string>('');

  // WebRTC connection ref
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const processedEventIdsRef = useRef<Set<string>>(new Set());

  const signalingAbortControllerRef = useRef<AbortController | null>(null);

  // Get host author info
  const hostAuthor = useAuthor(hostPubkey);
  const hostMetadata = hostAuthor.data?.metadata;
  const hostDisplayName = hostMetadata?.name ?? genUserName(hostPubkey);

  /**
   * Parse session event according to new protocol
   */
  const parseSignalEvent = useCallback((event: NostrEvent) => {
    const type = event.tags.find(t => t[0] === 'type')?.[1] as 'offer'|'answer'|'candidate'|undefined;
    const d = event.tags.find(t => t[0] === 'd')?.[1] || '';
    const to = event.tags.find(t => t[0] === 'p')?.[1] || null;
    if (!type || !d) return null;

    let payload: any = {};
    try { payload = JSON.parse(event.content || '{}'); } catch {}
    return { type, sessionId: d, from: event.pubkey, to, payload } as {
      type: 'offer'|'answer'|'candidate';
      sessionId: string;
      from: string;
      to: string|null;
      payload: any;
    };
  }, []);


  /**
   * Handle signaling events
   */
  const handleSignalEvent = useCallback(async (event: NostrEvent) => {
    if (processedEventIdsRef.current.has(event.id)) return;
    processedEventIdsRef.current.add(event.id);

    const parsed = parseSignalEvent(event);
    if (!parsed || !user || !peerConnectionRef.current) return;
    if (parsed.to !== user.pubkey) return;

    const pc = peerConnectionRef.current;

    try {
      if (parsed.type === 'offer' && parsed.payload?.sdp) {
        await pc.setRemoteDescription(parsed.payload.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await waitForIceGatheringComplete(pc);

        await publishEvent({
          kind: KIND_SIGNAL,
          content: JSON.stringify({ sdp: pc.localDescription! }),
          tags: [
            ['d', sessionId],
            ['type', 'answer'],
            ['p', parsed.from], // host
            ['expiration', String(Math.floor(Date.now()/1000) + 60)]
          ],
          relays: [config.relayUrl]
        });
        console.log('[GuestRoom] Sent answer to host (no-trickle)');

      } else if (parsed.type === 'candidate' && parsed.payload?.candidate) {
        await pc.addIceCandidate(parsed.payload.candidate);
        console.log('[GuestRoom] Added ICE candidate from host');
      }
    } catch (err) {
      console.error('[GuestRoom] handleSignalEvent error:', err);
    }
  }, [parseSignalEvent, user, sessionId, publishEvent, config.relayUrl]);

  /**
   * Initialize WebRTC connection and join session
   */
  useEffect(() => {
    const joinSession = async () => {
      if (!sessionId || !user || !nostr) {
        setError('Missing session ID, user login, or Nostr connection');
        setConnectionState('error');
        return;
      }

      try {
        console.log('[GuestRoom] Joining session:', sessionId);
        setConnectionState('connecting');
        setError(null);

        const mainRelay = nostr.relay(config.relayUrl);

        // Parse session ID to extract game ID
        const { gameId: parsedGameId } = parseSessionId(sessionId);
        setGameId(parsedGameId);

        // 1. Fetch game metadata in parallel (best-effort, non-blocking)
        const fetchGameMetadata = async () => {
          try {
            const gameEvents = await mainRelay.query([{
              kinds: [31996],
              '#d': [parsedGameId],
              limit: 1
            }], { signal: AbortSignal.timeout(10000) });

            if (gameEvents.length > 0) {
              const gameEvent = gameEvents[0] as NostrEvent;

              // Parse game metadata
              const getTagValue = (tagName: string): string | undefined => {
                const tag = gameEvent.tags.find(t => t[0] === tagName);
                return tag?.[1];
              };

              setGameMeta({
                id: parsedGameId,
                title: getTagValue('name') || 'Unknown Game',
                summary: getTagValue('summary'),
                genres: gameEvent.tags.filter(t => t[0] === 't').map(t => t[1]).filter(Boolean),
                modes: gameEvent.tags.filter(t => t[0] === 'mode').map(t => t[1]).filter(Boolean),
                status: getTagValue('status'),
                platforms: gameEvent.tags.filter(t => t[0] === 'platform').map(t => t[1]).filter(Boolean),
                assets: {
                  cover: gameEvent.tags.find(t => t[0] === 'image' && t[1] === 'cover')?.[2],
                  screenshots: []
                }
              });
            }
          } catch (err) {
            console.warn('[GuestRoom] Failed to fetch game metadata:', err);
            // Game metadata fetch failure doesn't block join
          }
        };

        // Start game metadata fetch in parallel (non-blocking)
        fetchGameMetadata();

        // 2. Fetch the latest session event from main relay only
        const sessionEvents = await mainRelay.query([{
          kinds: [KIND_SESSION],
          '#d': [sessionId],
          limit: 1
        }], { signal: AbortSignal.timeout(10000) });

        if (sessionEvents.length === 0) {
          throw new Error('Session not found or expired');
        }

        const sessionEvent = sessionEvents[0] as NostrEvent;

        // Start signaling subscription BEFORE sending join

        // Parse session data
        const getTag = (name: string) => sessionEvent.tags.find(t => t[0] === name)?.[1];
        const getTagValues = (name: string) => sessionEvent.tags.filter(t => t[0] === name).map(t => t[1]);

        const typeTag = getTag('type');
        const hostTag = getTag('host');
        const statusTag = getTag('status');
        const playersTag = getTag('players');
        const connectedTags = getTagValues('connected');

        if (typeTag !== 'session' || !hostTag) {
          throw new Error('Invalid session data');
        }

        if (statusTag === 'full') {
          throw new Error('Session is full');
        }

        setHostPubkey(hostTag);
        setConnectedPlayers(connectedTags.length + 1); // +1 para host

        // 3. Set up WebRTC connection (ANTES da assinatura 21997!)
        const peerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });

        peerConnectionRef.current = peerConnection;

        // Handle incoming video stream
        peerConnection.ontrack = (event) => {
          console.log('[GuestRoom] Received remote stream');
          const [remoteStream] = event.streams;

          if (videoRef.current) {
            videoRef.current.srcObject = remoteStream;
            setIsStreamActive(true);
            setConnectionState('receiving');
          }
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
          const state = peerConnection.connectionState;
          console.log('[GuestRoom] Connection state:', state);

          switch (state) {
            case 'connected':
              setConnectionState('connected');
              break;
            case 'disconnected':
            case 'failed':
              setConnectionState('disconnected');
              setIsStreamActive(false);
              break;
            case 'closed':
              setConnectionState('disconnected');
              setIsStreamActive(false);
              break;
          }
        };

        // Handle ICE connection state changes
        peerConnection.oniceconnectionstatechange = () => {
          console.log('[GuestRoom] ICE connection state:', peerConnection.iceConnectionState);
        };

        // Handle ICE candidates
         peerConnection.onicecandidate = () => { /* no-op (no-trickle) */ };

        peerConnection.ondatachannel = (e) => {
          const ch = e.channel;
          ch.onopen = () => console.log('[GuestRoom] Data channel open:', ch.label);
          ch.onmessage = (msg) => {
            // por enquanto só loga
            console.log('[GuestRoom] Data from host:', msg.data);
          };
        };

        if (user) {
          const signalingController = new AbortController();
          (async () => {
            try {
              for await (const ev of mainRelay.req([{
                kinds: [KIND_SIGNAL],
                '#d': [sessionId],
                '#p': [user.pubkey],       // endereçadas a este guest
                authors: [hostTag],        // emitidas pelo host
                since: Math.floor(Date.now()/1000) - 60
              }], { signal: signalingController.signal })) {
                if (ev[0] === 'EVENT') {
                  await handleSignalEvent(ev[2]);
                } else if (ev[0] === 'EOSE') {
                  console.log('[GuestRoom] Signaling subscription EOSE');
                }
              }
            } catch (err:any) {
              if (err.name !== 'AbortError') console.error('[GuestRoom] 21997 sub error:', err);
            }
          })();
          signalingAbortControllerRef.current = signalingController;
        }

        // 4. Publish join intent
        if (sessionId && user?.pubkey) {
          publishEvent({
            kind: 31997,
            content: '',
            tags: [
              ['d', sessionId],
              ['type', 'join'],
              ['from', user.pubkey],
              ['to', hostTag]
            ],
            relays: [config.relayUrl]
          });
        }

        console.log('[GuestRoom] Join intent sent, waiting for offer from host');

      } catch (err) {
        console.error('[GuestRoom] Failed to join session:', err);
        setError(err instanceof Error ? err.message : 'Failed to join session');
        setConnectionState('error');
      }
    };

    if (sessionId) {
      joinSession();
    }

    // Cleanup function
    return () => {
      signalingAbortControllerRef.current?.abort();
      signalingAbortControllerRef.current = null;

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      processedEventIdsRef.current.clear();
    };
  }, [sessionId, user, nostr, publishEvent, config.relayUrl, handleSignalEvent]);

  /**
   * Retry connection
   */
  const handleRetry = () => {
    setError(null);
    setIsStreamActive(false);
    setConnectionState('connecting');
    // Re-trigger the effect by updating a dependency or manually call initializeWebRTC
  };

  /**
   * Leave session and go back
   */
  const handleLeave = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    navigate('/games');
  };

  /**
   * Get connection status info
   */
  const getConnectionInfo = () => {
    switch (connectionState) {
      case 'connecting':
        return {
          icon: <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>,
          text: 'Connecting to session...',
          color: 'text-gray-400'
        };
      case 'connected':
        return {
          icon: <Wifi className="w-4 h-4 text-green-400" />,
          text: 'Connected - Waiting for stream',
          color: 'text-green-400'
        };
      case 'receiving':
        return {
          icon: <Play className="w-4 h-4 text-green-400" />,
          text: 'Receiving game stream',
          color: 'text-green-400'
        };
      case 'error':
        return {
          icon: <WifiOff className="w-4 h-4 text-red-400" />,
          text: 'Connection failed',
          color: 'text-red-400'
        };
      case 'disconnected':
        return {
          icon: <WifiOff className="w-4 h-4 text-gray-400" />,
          text: 'Disconnected',
          color: 'text-gray-400'
        };
      default:
        return {
          icon: <WifiOff className="w-4 h-4 text-gray-400" />,
          text: 'Unknown status',
          color: 'text-gray-400'
        };
    }
  };

  const connectionInfo = getConnectionInfo();

  // Check if user is logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Card className="w-full max-w-2xl border-yellow-500 bg-gray-900">
          <CardContent className="p-8 text-center">
            <div className="text-yellow-400 text-6xl mb-4">🔐</div>
            <h3 className="text-xl font-semibold text-white mb-2">Login Required</h3>
            <p className="text-gray-400 mb-4">You must be logged in with Nostr to join multiplayer sessions</p>
            <div className="space-y-2">
              <Button onClick={handleLeave} variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (connectionState === 'connecting' && !error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Card className="w-full max-w-2xl border-gray-800 bg-gray-900">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-white mb-2">Joining Session</h3>
            <p className="text-gray-400">Connecting to multiplayer session...</p>
            <div className="mt-4">
              <Button onClick={handleLeave} variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (connectionState === 'error') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Card className="w-full max-w-2xl border-red-500 bg-gray-900">
          <CardContent className="p-8 text-center">
            <div className="text-red-400 text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-white mb-2">Connection Failed</h3>
            <p className="text-gray-400 mb-4">{error}</p>
            <div className="space-y-2">
              <Button onClick={handleRetry} className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={handleLeave} variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Leave Session
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={handleLeave} className="text-gray-300 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Leave Session
              </Button>

              <div>
                <h1 className="text-xl font-bold text-white">
                  {gameMeta?.title || 'Multiplayer Session'}
                </h1>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Badge variant="secondary" className="bg-purple-900 text-purple-300 border-purple-700">
                    Guest View
                  </Badge>
                  {hostDisplayName && (
                    <span className="text-xs">
                      Host: {hostDisplayName}
                    </span>
                  )}
                  {connectedPlayers > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {connectedPlayers} players
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Connection Status */}
            <div className="flex items-center gap-2">
              {connectionInfo.icon}
              <span className={`text-sm ${connectionInfo.color}`}>
                {connectionInfo.text}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Main video area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Video Stream */}
            <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
              {/* Video element - hidden until stream is received */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={false}
                className={`w-full h-full object-contain ${isStreamActive ? 'block' : 'hidden'}`}
                style={{ display: isStreamActive ? 'block' : 'none' }}
              />

              {/* Placeholder when no stream */}
              {!isStreamActive && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Play className="w-8 h-8 text-gray-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Waiting for Stream</h3>
                    <p className="text-gray-400 text-sm">
                      {connectionState === 'connected'
                        ? 'Connected to session. Waiting for host to start the game...'
                        : 'Establishing connection...'
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* Connection overlay */}
              {connectionState !== 'receiving' && (
                <div className="absolute top-4 left-4">
                  <div className="flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm rounded px-3 py-2">
                    {connectionInfo.icon}
                    <span className={`text-sm ${connectionInfo.color}`}>
                      {connectionInfo.text}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Game Controls below video - for input if implemented */}
            {isStreamActive && <GameControls />}

            {/* Connection Controls */}
            <Card className="border-gray-800 bg-gray-900">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-3">
                  {((connectionState as ConnectionState) === 'error' || connectionState === 'disconnected') && (
                    <Button onClick={handleRetry} className="bg-purple-600 hover:bg-purple-700">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reconnect
                    </Button>
                  )}

                  <Button
                    onClick={handleLeave}
                    variant="outline"
                    className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Leave Session
                  </Button>

                  <div className="flex-1 text-xs text-gray-500 flex items-center">
                    <p>You are viewing this game session as a guest. The host ({hostDisplayName}) controls the gameplay.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right side - Player Chat and Session Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Player Chat */}
            <MultiplayerChat
              onlineCount={connectedPlayers}
              currentUser="Guest"
              isHost={false}
            />

            {/* Session Info Card */}
            <Card className="border-gray-800 bg-gray-900">
              <CardContent className="p-4 space-y-4">
                <h3 className="text-lg font-semibold text-white">Session Info</h3>

                {gameMeta?.assets?.cover && (
                  <div className="aspect-video rounded-lg overflow-hidden">
                    <img
                      src={gameMeta.assets.cover}
                      alt={gameMeta.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {gameMeta?.summary && (
                  <div>
                    <span className="text-gray-500">Description:</span>
                    <p className="text-gray-300 text-sm mt-1">{gameMeta.summary}</p>
                  </div>
                )}

                <div className="space-y-2 text-sm">
                  {gameMeta?.genres?.length && gameMeta.genres.length > 0 && (
                    <div>
                      <span className="text-gray-500">Genre:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {gameMeta.genres.slice(0, 3).map((genre: string) => (
                          <span key={genre} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                            {genre}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {gameMeta?.platforms?.length && gameMeta.platforms.length > 0 && (
                    <div>
                      <span className="text-gray-500">Platform:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {gameMeta.platforms.slice(0, 2).map((platform: string) => (
                          <span key={platform} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                            {platform}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-800">
                    <span className="text-gray-500">Session:</span>
                    <div className="text-xs text-gray-400 mt-1 space-y-1">
                      <div>Mode: Guest (View Only)</div>
                      <div>Game ID: {gameId}</div>
                      <div>Host: {hostDisplayName}</div>
                      <div>Status: {connectionInfo.text}</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-800 mt-4">
                    <Link
                      to="https://soapbox.pub/mkstack"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-purple-400 transition-colors"
                    >
                      Vibed with MKStack
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}