import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';
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

interface ConnectedPlayer {
  id: string;
  name: string;
  avatar?: string;
  status: 'ready' | 'waiting' | 'playing';
}

interface MultiplayerCardProps {
  gameMeta: GameMetadata;
  className?: string;
  onSessionStatusChange?: (status: SessionStatus) => void;
}

type SessionStatus = 'idle' | 'creating' | 'waiting' | 'active' | 'error';
type InteractionMode = 'idle' | 'starting' | 'joining';

export default function MultiplayerCard({
  gameMeta,
  className,
  onSessionStatusChange
}: MultiplayerCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('idle');
  const [connectedPlayers, setConnectedPlayers] = useState<ConnectedPlayer[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [joinSessionId, setJoinSessionId] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(true);

  // Mock connected players for demo
  const mockPlayers: ConnectedPlayer[] = [
    {
      id: '1',
      name: 'Player1',
      avatar: undefined,
      status: 'ready'
    },
    {
      id: '2',
      name: 'GamerPro',
      avatar: undefined,
      status: 'waiting'
    },
    {
      id: '3',
      name: 'RetroKing',
      avatar: undefined,
      status: 'ready'
    }
  ];

  /**
   * Generate a random session ID
   */
  const generateSessionId = (): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  /**
   * Handle clicking "Start Session" button
   */
  const handleStartSession = () => {
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    setInteractionMode('starting');
    setIsHost(true);
  };

  /**
   * Actually create the session after showing the invite link
   */
  const handleCreateSession = async () => {
    try {
      const newStatus: SessionStatus = 'creating';
      setSessionStatus(newStatus);
      onSessionStatusChange?.(newStatus);

      // TODO: Implement actual multiplayer session creation
      // This would typically involve:
      // 1. Creating a WebRTC offer
      // 2. Publishing session info to Nostr
      // 3. Setting up peer connections

      // Simulate session creation
      await new Promise(resolve => setTimeout(resolve, 1500));

      const waitingStatus: SessionStatus = 'waiting';
      setSessionStatus(waitingStatus);
      onSessionStatusChange?.(waitingStatus);

      setConnectedPlayers([{
        id: 'host',
        name: 'You (Host)',
        status: 'ready'
      }]);

      // Simulate other players joining
      setTimeout(() => {
        setConnectedPlayers(prev => [...prev, ...mockPlayers.slice(0, 2)]);
      }, 2000);

    } catch (error) {
      console.error('Failed to start session:', error);
      const errorStatus: SessionStatus = 'error';
      setSessionStatus(errorStatus);
      onSessionStatusChange?.(errorStatus);
    }
  };

  /**
   * Handle clicking "Join Session" button
   */
  const handleJoinSession = () => {
    setInteractionMode('joining');
    setIsHost(false);
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
    const activeStatus: SessionStatus = 'active';
    setSessionStatus(activeStatus);
    onSessionStatusChange?.(activeStatus);
    // TODO: Signal all peers to start the game
    console.log('Starting multiplayer game...');
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
    const idleStatus: SessionStatus = 'idle';
    setSessionStatus(idleStatus);
    onSessionStatusChange?.(idleStatus);
    setConnectedPlayers([]);
    setIsHost(false);
    setSessionId('');
    setJoinSessionId('');
  };

  const handleLeaveSession = () => {
    handleGoBack();
  };

  const getStatusIcon = () => {
    switch (sessionStatus) {
      case 'idle':
        return <WifiOff className="w-4 h-4" />;
      case 'creating':
      case 'waiting':
        return <Clock className="w-4 h-4 animate-pulse" />;
      case 'active':
        return <Wifi className="w-4 h-4 text-green-400" />;
      case 'error':
        return <WifiOff className="w-4 h-4 text-red-400" />;
      default:
        return <WifiOff className="w-4 h-4" />;
    }
  };

  const getStatusText = () => {
    switch (sessionStatus) {
      case 'idle':
        return 'Not Connected';
      case 'creating':
        return 'Creating Session...';
      case 'waiting':
        return `Waiting for Players (${connectedPlayers.length}/4)`;
      case 'active':
        return 'Game Active';
      case 'error':
        return 'Connection Error';
      default:
        return 'Unknown';
    }
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
        {sessionStatus === 'idle' && interactionMode === 'idle' && (
          <div className="space-y-2">
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
          </div>
        )}

        {/* Start Session Mode - Show Invite Link */}
        {interactionMode === 'starting' && sessionStatus === 'idle' && (
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

            <div className="flex gap-2">
              <Button
                onClick={handleCreateSession}
                className="flex-1 bg-green-600 hover:bg-green-700"
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
        {sessionStatus === 'creating' && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-400">
              {isHost ? 'Creating session...' : 'Joining session...'}
            </p>
          </div>
        )}

        {/* Connected Players */}
        {(sessionStatus === 'waiting' || sessionStatus === 'active') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">
                Connected Players
              </span>
              <Badge variant="outline" className="border-gray-600 text-gray-400">
                <Users className="w-3 h-3 mr-1" />
                {connectedPlayers.length}/4
              </Badge>
            </div>

            <div className="space-y-2 max-h-32 overflow-y-auto">
              {connectedPlayers.map((player) => (
                <div key={player.id} className="flex items-center gap-3 p-2 bg-gray-800 rounded">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={player.avatar} />
                    <AvatarFallback className="text-xs bg-gray-700 text-gray-300">
                      {player.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-gray-300 flex-1">{player.name}</span>
                  <Badge
                    variant={player.status === 'ready' ? 'default' : 'secondary'}
                    className={`text-xs ${
                      player.status === 'ready'
                        ? 'bg-green-900 text-green-300 border-green-700'
                        : 'bg-yellow-900 text-yellow-300 border-yellow-700'
                    }`}
                  >
                    {player.status}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Session Actions */}
            <div className="space-y-2">
              {sessionStatus === 'waiting' && isHost && connectedPlayers.length >= 2 && (
                <Button
                  onClick={handleStartGame}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Game
                </Button>
              )}

              {sessionStatus === 'waiting' && !isHost && (
                <div className="text-center py-2">
                  <p className="text-sm text-gray-400">Waiting for host to start...</p>
                </div>
              )}

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
        {sessionStatus === 'error' && (
          <div className="text-center py-4">
            <div className="text-red-400 text-2xl mb-2">⚠️</div>
            <p className="text-sm text-gray-400 mb-3">Failed to connect to session</p>
            <Button
              onClick={() => setSessionStatus('idle')}
              variant="outline"
              size="sm"
              className="bg-gray-800 border-gray-700 text-gray-300"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Active Game State */}
        {sessionStatus === 'active' && (
          <div className="text-center py-4 bg-green-900/20 rounded border border-green-800">
            <Wifi className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-green-300 font-medium">Game is live!</p>
            <p className="text-xs text-gray-400 mt-1">
              Playing with {connectedPlayers.length - 1} other player(s)
            </p>
          </div>
        )}
        </CardContent>
      )}
    </Card>
  );
}