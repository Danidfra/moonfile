/**
 * Multiplayer Guest Room Page
 *
 * For guests joining multiplayer sessions. Uses a video element instead of NesPlayer
 * to receive the host's game stream via WebRTC. Maintains visual consistency with
 * the host room while providing a spectator/guest experience.
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, Users, Wifi, WifiOff, Play } from 'lucide-react';
import MultiplayerChat from '@/components/MultiplayerChat';
import GameControls from '@/components/GameControls';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { useMultiplayerSession } from '@/hooks/useMultiplayerSession';
import { useNostr } from '@jsr/nostrify__react';
import { useAppContext } from '@/hooks/useAppContext';
import { genUserName } from '@/lib/genUserName';

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
  const { user } = useCurrentUser();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { nostr } = useNostr();
  const { config } = useAppContext();

  // Parse session ID to get game ID
  const { gameId: parsedGameId } = parseSessionId(sessionId);

  // Use the multiplayer session hook
  const {
    session,
    status,
    connectedPlayers,
    error: mpError,
    joinSession,
    leaveSession,
    sendChatMessage,
    sendGameInput,
  } = useMultiplayerSession(parsedGameId);

  // State management
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [gameMeta, setGameMeta] = useState<GameMetadata | null>(null);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [messages, setMessages] = useState<Array<{ text: string; from?: string; ts: number }>>([]);
  const hostPubkey = session?.hostPubkey ?? '';
  const [gameId, setGameId] = useState<string>(parsedGameId);

  // Guest input focus state
  const [focused, setFocused] = useState(false);
  const pressedRef = useRef<Set<string>>(new Set());

  // Scroll lock functions
  const lockScroll = () => document.body.classList.add('overflow-hidden');
  const unlockScroll = () => document.body.classList.remove('overflow-hidden');

  // Map keyboard events to NES buttons
  const mapKey = (e: KeyboardEvent): string | null => {
    const { code, key } = e;
    if (key.startsWith('Arrow')) return key.replace('Arrow', '');
    if (code === 'Enter') return 'Start';
    if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Select';
    if (code === 'KeyZ') return 'A';
    if (code === 'KeyX') return 'B';
    if (code === 'Space') return 'Start';
    return null;
  };

  // Handle input focus and event listeners
  useEffect(() => {
    if (!focused) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const k = mapKey(e);
      if (!k) return;
      if ([' ', 'ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
      if (pressedRef.current.has(k)) return;
      pressedRef.current.add(k);
      sendGameInput({ key: k, pressed: true });
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = mapKey(e);
      if (!k) return;
      e.preventDefault();
      pressedRef.current.delete(k);
      sendGameInput({ key: k, pressed: false });
    };

    const onWheel = (e: WheelEvent) => { e.preventDefault(); };

    const onContext = (e: MouseEvent) => {
      e.preventDefault(); // right click → B
      sendGameInput({ key: 'B', pressed: true });
      setTimeout(() => sendGameInput({ key: 'B', pressed: false }), 10);
    };

    const onBlur = () => releaseFocus();

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp, { passive: false });
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('contextmenu', onContext);
    window.addEventListener('blur', onBlur);

    lockScroll();

    return () => {
      window.removeEventListener('keydown', onKeyDown as any);
      window.removeEventListener('keyup', onKeyUp as any);
      window.removeEventListener('wheel', onWheel as any);
      window.removeEventListener('contextmenu', onContext as any);
      window.removeEventListener('blur', onBlur as any);
      unlockScroll();
      const currentPressed = pressedRef.current;
      currentPressed.clear();
    };
  }, [focused, sendGameInput]);

  // Handle ESC key to exit focus
  useEffect(() => {
    if (!focused) return;
    const onEsc = (e: KeyboardEvent) => { if (e.code === 'Escape') releaseFocus(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [focused]);

  const requestFocus = () => setFocused(true);
  const releaseFocus = () => setFocused(false);

  // Get host author info
  const hostAuthor = useAuthor(hostPubkey);
  const hostMetadata = hostAuthor.data?.metadata;
  const hostDisplayName = hostMetadata?.name ?? genUserName(hostPubkey);

  const joinedRef = useRef<string | null>(null);
  const firstCleanupSkipRef = useRef(true);

  // Join session on mount, leave on unmount
  useEffect(() => {
    if (!sessionId) return;
    if (joinedRef.current === sessionId) return;
    joinedRef.current = sessionId;
    joinSession(sessionId);

    return () => {
      if (firstCleanupSkipRef.current) {
        firstCleanupSkipRef.current = false;
        return;
      }
      leaveSession();
    };
  }, [sessionId, joinSession, leaveSession]);

  // Handle host video stream
  useEffect(() => {
    const onStream = (e: CustomEvent<MediaStream>) => {
      const stream = e.detail;

      const s = e.detail as MediaStream;
      console.log('[GuestRoom] incoming tracks:', s.getTracks().map(t => ({kind: t.kind, enabled: t.enabled, readyState: t.readyState})));

      const el = videoRef.current;
      if (!el) return;
      el.muted = true;
      el.srcObject = stream;

      const tryPlay = () => {
        el.play().then(() => {
          setIsStreamActive(true);
          setConnectionState('receiving');
        }).catch((err) => {
          console.warn('[GuestRoom] video.play() blocked/deferred', err);
        });
      };
      if (el.readyState >= 2) {
        tryPlay();
      } else {
        el.onloadedmetadata = () => tryPlay();
      }
    };
    window.addEventListener('hostVideoStream', onStream as EventListener);
    return () => window.removeEventListener('hostVideoStream', onStream as EventListener);
  }, []);

  // Handle incoming chat messages
  useEffect(() => {
    const onIncoming = (e: CustomEvent<{ text: string; from?: string; ts: number }>) => {
      setMessages(prev => [...prev, e.detail]); // {type:'chat', text, from, ts}
    };
    window.addEventListener('chat:incoming', onIncoming as EventListener);
    return () => window.removeEventListener('chat:incoming', onIncoming as EventListener);
  }, []);

  // Map hook status to UI connection state
  useEffect(() => {
    if (mpError) {
      setError(mpError);
      setConnectionState('error');
      return;
    }
    switch (status) {
      case 'creating':
        setConnectionState('connecting');
        break;
      case 'available':
        if (!isStreamActive) setConnectionState('connected'); // waiting for stream
        break;
      case 'full':
        setError('Session is full');
        setConnectionState('error');
        break;
      case 'idle':
        setConnectionState('connecting');
        break;
      default:
        break;
    }
  }, [status, mpError, isStreamActive]);

  // Fetch game metadata (read-only, now using top-level hooks)
  useEffect(() => {
    const fetchGameMetadata = async () => {
      if (!parsedGameId) return;

      try {
        const mainRelay = nostr.relay(config.relayUrl);
        const gameEvents = await mainRelay.query([{
          kinds: [31996],
          '#d': [parsedGameId],
          limit: 1
        }], { signal: AbortSignal.timeout(10000) });

        if (gameEvents.length > 0) {
          const gameEvent = gameEvents[0];

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
      }
    };

    setGameId(parsedGameId);
    fetchGameMetadata();
  }, [parsedGameId, nostr, config.relayUrl]);

  /**
   * Retry connection
   */
  const handleRetry = () => {
    setError(null);
    setIsStreamActive(false);
    setConnectionState('connecting');
    if (sessionId) {
      joinSession(sessionId);
    }
  };

  /**
   * Leave session and go back
   */
  const handleLeave = () => {
    leaveSession();
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
                  {(connectedPlayers?.length ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {(connectedPlayers?.length ?? 0) + 1} players
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
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted={true}
                  className={`w-full h-full object-contain ${isStreamActive ? 'block' : 'hidden'}`}
                  style={{ display: isStreamActive ? 'block' : 'none' }}
                  onClick={requestFocus}
                />

                {/* Focus overlay */}
                {focused && (
                  <div className="absolute top-2 left-2 text-xs bg-black/60 px-2 py-1 rounded">
                    Focused — press ESC to exit
                  </div>
                )}
              </div>

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
              onlineCount={(connectedPlayers?.length ?? 0) + 1}
              currentUser="Guest"
              isHost={false}
              messages={messages.map(msg => ({
                id: `msg-${msg.ts}`,
                user: msg.from === user?.pubkey ? 'You' : (msg.from?.substring(0, 8) + '...' || 'Unknown'),
                message: msg.text,
                time: 'Just now',
                isCurrentUser: msg.from === user?.pubkey
              }))}
              onSend={sendChatMessage}
              useMockFallback={false}
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