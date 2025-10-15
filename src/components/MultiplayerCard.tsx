import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';
import { useMultiplayerSession } from '@/hooks/useMultiplayerSession';
import { useGameStream } from '@/hooks/useGameStream';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import {
  Users,
  Play,
  UserPlus,
  Wifi,
  WifiOff,
  Clock,
  GamepadIcon,
  Copy,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface GameMetadata {
  id: string;
  title: string;
  assets: {
    cover?: string;
    icon?: string;
  };
}

interface MultiplayerCardProps {
  gameMeta: GameMetadata;
  className?: string;
  onSessionStatusChange?: (status: SessionStatus) => void;
  onStreamStart?: (stream: MediaStream) => void;
  getGameStream?: () => MediaStream | null;
  maxPlayers?: number;
  defaultExpanded?: boolean;
}

type SessionStatus = 'idle' | 'creating' | 'available' | 'full' | 'error';
type InteractionMode = 'idle' | 'starting' | 'joining';

export default function MultiplayerCard({
  gameMeta,
  className,
  onSessionStatusChange,
  onStreamStart,
  getGameStream,
  maxPlayers = 2,
  defaultExpanded
}: MultiplayerCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useCurrentUser();

  // Use the new multiplayer session hook
  const {
    sessionId,
    session,
    isHost,
    status,
    connectedPlayers,
    error,
    startSession,
    joinSession,
    leaveSession
  } = useMultiplayerSession(gameMeta.id);

  // Use game stream hook for video capture
  const { startStream, stopStream, getStream } = useGameStream({
    width: 256,
    height: 240,
    frameRate: 60
  });

  const [interactionMode, setInteractionMode] = useState<InteractionMode>('idle');
  const [joinSessionId, setJoinSessionId] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? true);

  // Set max players from props
  const maxPlayersRef = useRef(maxPlayers);
  maxPlayersRef.current = maxPlayers;

  // Sync status with parent component
  useEffect(() => {
    onSessionStatusChange?.(status);
  }, [status, onSessionStatusChange]);

  /**
   * Handle clicking "Start Session" button
   */
  const handleStartSession = () => {
    setInteractionMode('starting');
  };

  /**
   * Actually create the session after showing the invite link
   */
  const handleCreateSession = async () => {
    if (!getGameStream) {
      toast({
        title: "Game Not Ready",
        description: "Game streaming not available",
        variant: "destructive"
      });
      return;
    }

    try {
      // Get video stream from the game
      const stream = getGameStream();
      if (!stream) {
        throw new Error('Failed to capture game stream - make sure the game is running');
      }

      // Notify parent component about the stream
      onStreamStart?.(stream);

      // Start the multiplayer session (no offer created immediately)
      await startSession(stream, maxPlayersRef.current);

      setInteractionMode('idle');

      toast({
        title: "Session Created!",
        description: "Your multiplayer session is now active and waiting for players",
      });

    } catch (error) {
      console.error('Failed to start session:', error);
      toast({
        title: "Session Failed",
        description: error instanceof Error ? error.message : "Failed to create session",
        variant: "destructive"
      });
    }
  };

  /**
   * Handle clicking "Join Session" button
   */
  const handleJoinSession = () => {
    setInteractionMode('joining');
  };

  /**
   * Handle joining a session with the entered session ID
   */
  const handleJoinWithId = () => {
    if (!joinSessionId.trim()) {
      toast({
        title: "Session ID Required",
        description: "Please enter a valid session ID",
        variant: "destructive"
      });
      return;
    }

    // Navigate to the guest room with the entered session ID
    navigate(`/multiplayer/guest/${joinSessionId.trim()}`);
  };

  const handleStartGame = () => {
    // Game is automatically started when session is created
    // This could be extended to signal specific game start events
    console.log('Game is already running in multiplayer mode');
  };

  /**
   * Copy invite link to clipboard
   */
  const handleCopyLink = async () => {
    const inviteLink = `/multiplayer/guest/${sessionId}`;
    try {
      await navigator.clipboard.writeText(window.location.origin + inviteLink);
      toast({
        title: "Link Copied!",
        description: "Invite link has been copied to clipboard",
      });
    } catch (error) {
      console.error('Failed to copy link:', error);
      toast({
        title: "Copy Failed",
        description: "Could not copy link to clipboard",
        variant: "destructive"
      });
    }
  };

  /**
   * Go back to idle state
   */
  const handleGoBack = () => {
    setInteractionMode('idle');
    setJoinSessionId('');
  };

  const handleLeaveSession = () => {
    leaveSession();
    stopStream();
    setInteractionMode('idle');
    setJoinSessionId('');

    toast({
      title: "Left Session",
      description: "You have left the multiplayer session",
    });
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'idle':
        return <WifiOff className="w-4 h-4" />;
      case 'creating':
        return <Clock className="w-4 h-4 animate-pulse" />;
      case 'available':
        return <Wifi className="w-4 h-4 text-yellow-400" />;
      case 'full':
        return <Wifi className="w-4 h-4 text-green-400" />;
      case 'error':
        return <WifiOff className="w-4 h-4 text-red-400" />;
      default:
        return <WifiOff className="w-4 h-4" />;
    }
  };

  const getStatusText = () => {
    if (error) return 'Connection Error';

    switch (status) {
      case 'idle':
        return 'Not Connected';
      case 'creating':
        return 'Creating Session...';
      case 'available':
        return `Available (${connectedPlayers.length + (isHost ? 1 : 0)}/${maxPlayers})`;
      case 'full':
        return 'Room Full - Game Active';
      case 'error':
        return 'Connection Error';
      default:
        return 'Unknown';
    }
  };

  // Component to display connected players with profile info
  const PlayerAvatar = ({ pubkey }: { pubkey: string }) => {
    const author = useAuthor(pubkey);
    const metadata = author.data?.metadata;
    const displayName = metadata?.name ?? genUserName(pubkey);

    return (
      <div className="flex items-center gap-3 p-2 bg-gray-800 rounded">
        <Avatar className="w-6 h-6">
          <AvatarImage src={metadata?.picture} />
          <AvatarFallback className="text-xs bg-gray-700 text-gray-300">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm text-gray-300 flex-1">{displayName}</span>
        <Badge
          variant="default"
          className="text-xs bg-green-900 text-green-300 border-green-700"
        >
          connected
        </Badge>
      </div>
    );
  };

  return (
    <Card className={`border-gray-800 bg-gray-900 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2 text-lg">
            <GamepadIcon className="w-5 h-5" />
            Multiplayer Session
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white p-1 h-auto"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm text-gray-400">{getStatusText()}</span>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-4 pt-0 space-y-4">
        {/* Game Cover */}
        {gameMeta.assets?.cover && (
          <div className="aspect-video rounded-lg overflow-hidden">
            <img
              src={gameMeta.assets.cover}
              alt={gameMeta.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Game Title */}
        <div>
          <h3 className="font-semibold text-white">{gameMeta.title}</h3>
          <Badge variant="secondary" className="mt-1 bg-purple-900 text-purple-300 border-purple-700">
            Multiplayer Enabled
          </Badge>
        </div>

        <Separator className="bg-gray-800" />

        {/* Session Controls */}
        {status === 'idle' && interactionMode === 'idle' && (
          <div className="space-y-2">
            {user ? (
              <>
                <Button
                  onClick={handleStartSession}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Session
                </Button>
                <Button
                  onClick={handleJoinSession}
                  variant="outline"
                  className="w-full bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Join Session
                </Button>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-400 mb-2">Login required for multiplayer</p>
                <Button disabled variant="outline" className="w-full">
                  <Users className="w-4 h-4 mr-2" />
                  Multiplayer Unavailable
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Start Session Mode - Show Invite Link */}
        {interactionMode === 'starting' && status === 'idle' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-300">
                Ready to Create Session
              </Label>
              <p className="text-xs text-gray-500">
                This will start streaming your game to other players. Make sure your game is loaded and ready.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCreateSession}
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={!getGameStream}
              >
                <Play className="w-4 h-4 mr-2" />
                Create Session
              </Button>
              <Button
                onClick={handleGoBack}
                variant="outline"
                size="sm"
                className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Session Active - Show Invite Link */}
        {(status === 'available' || status === 'full') && sessionId && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-link" className="text-sm font-medium text-gray-300">
                Invite Link
              </Label>
              <div className="flex gap-2">
                <Input
                  id="invite-link"
                  value={`/multiplayer/guest/${sessionId}`}
                  readOnly
                  className="flex-1 bg-gray-800 border-gray-700 text-gray-300 font-mono text-sm"
                />
                <Button
                  onClick={handleCopyLink}
                  size="sm"
                  variant="outline"
                  className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                  aria-label="Copy invite link"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Share this link with other players to join your session
              </p>
            </div>
          </div>
        )}

        {/* Join Session Mode - Show Session ID Input */}
        {interactionMode === 'joining' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="session-id" className="text-sm font-medium text-gray-300">
                Enter Session ID
              </Label>
              <Input
                id="session-id"
                value={joinSessionId}
                onChange={(e) => setJoinSessionId(e.target.value)}
                placeholder="e.g. abc123xyz"
                className="bg-gray-800 border-gray-700 text-white placeholder-gray-500"
              />
              <p className="text-xs text-gray-500">
                Enter the session ID provided by the host
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleJoinWithId}
                disabled={!joinSessionId.trim()}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Join
              </Button>
              <Button
                onClick={handleGoBack}
                variant="outline"
                size="sm"
                className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {status === 'creating' && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-400">
              {isHost ? 'Creating session...' : 'Joining session...'}
            </p>
          </div>
        )}

        {/* Connected Players */}
        {(status === 'available' || status === 'full') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">
                Connected Players
              </span>
              <Badge variant="outline" className="border-gray-600 text-gray-400">
                <Users className="w-3 h-3 mr-1" />
                {(connectedPlayers.length + (isHost ? 1 : 0))}/{maxPlayers}
              </Badge>
            </div>

            <div className="space-y-2 max-h-32 overflow-y-auto">
              {/* Show host */}
              {isHost && user && (
                <div className="flex items-center gap-3 p-2 bg-gray-800 rounded">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-xs bg-purple-700 text-purple-300">
                      H
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-gray-300 flex-1">You (Host)</span>
                  <Badge className="text-xs bg-purple-900 text-purple-300 border-purple-700">
                    host
                  </Badge>
                </div>
              )}

              {/* Show connected guests */}
              {session?.connected.map((pubkey) => (
                <PlayerAvatar key={pubkey} pubkey={pubkey} />
              ))}
            </div>

            {/* Session Actions */}
            <div className="space-y-2">
              <Button
                onClick={handleLeaveSession}
                variant="outline"
                className="w-full bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
              >
                Leave Session
              </Button>
            </div>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="text-center py-4">
            <div className="text-red-400 text-2xl mb-2">⚠️</div>
            <p className="text-sm text-gray-400 mb-3">{error || "Failed to connect to session"}</p>
            <Button
              onClick={handleLeaveSession}
              variant="outline"
              size="sm"
              className="bg-gray-800 border-gray-700 text-gray-300"
            >
              Reset
            </Button>
          </div>
        )}

        {/* Full Game State */}
        {status === 'full' && (
          <div className="text-center py-4 bg-green-900/20 rounded border border-green-800">
            <Wifi className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-green-300 font-medium">Room Full - Game Active!</p>
            <p className="text-xs text-gray-400 mt-1">
              All players connected and ready to play
            </p>
          </div>
        )}
        </CardContent>
      )}
    </Card>
  );
}