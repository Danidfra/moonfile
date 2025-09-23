import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, Wifi, WifiOff, Crown, Loader2, Play, Copy, Share, ExternalLink } from 'lucide-react';
import { useAuthor } from '@/hooks/useAuthor';

interface ConnectedPlayer {
  pubkey: string;
  signal?: string;
}

interface MultiplayerWaitingScreenProps {
  status: 'waiting' | 'active' | 'full' | 'error';
  connectedPlayers: ConnectedPlayer[];
  requiredPlayers: number;
  hostPubkey: string;
  isHost: boolean;
  onStartGame?: () => void;
  error?: string;
  shareableLink?: string;
  canJoinGame?: boolean;
  onJoinGame?: () => void;
  isJoining?: boolean;
  connectionState?: string;
  className?: string;
}

export default function MultiplayerWaitingScreen({
  status,
  connectedPlayers,
  requiredPlayers,
  hostPubkey,
  isHost,
  onStartGame,
  error,
  shareableLink,
  canJoinGame = false,
  onJoinGame,
  isJoining = false,
  connectionState,
  className = ""
}: MultiplayerWaitingScreenProps) {
  const [copied, setCopied] = useState(false);

  const allPlayersConnected = connectedPlayers.length >= requiredPlayers;
  const canStartGame = status === 'full' && isHost;

  const copyInviteLink = async () => {
    if (shareableLink) {
      try {
        await navigator.clipboard.writeText(shareableLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy link:', err);
      }
    }
  };

  const shareInviteLink = async () => {
    if (shareableLink && typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: 'Join my multiplayer game!',
          text: 'Click this link to join the game:',
          url: shareableLink,
        });
      } catch (err) {
        console.error('Failed to share:', err);
      }
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center min-h-[400px] ${className}`}>
      <Card className="w-full max-w-md border-gray-800 bg-gray-900">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl text-white flex items-center justify-center gap-2">
            <Users className="w-5 h-5" />
            Multiplayer Room
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Status Message */}
          <div className="text-center">
            {status === 'waiting' && (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-blue-400">
                  <Wifi className="w-5 h-5" />
                  <span className="font-medium">Waiting for other players to join...</span>
                </div>
                <p className="text-sm text-gray-400">
                  Share this room link with friends to start playing together
                </p>
              </div>
            )}

            {status === 'active' && (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-yellow-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-medium">Connecting players...</span>
                </div>
                <p className="text-sm text-gray-400">
                  Establishing peer-to-peer connections
                </p>
              </div>
            )}

            {status === 'full' && (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-green-400">
                  <Wifi className="w-5 h-5" />
                  <span className="font-medium">All players connected!</span>
                </div>
                <p className="text-sm text-gray-400">
                  Ready to start the game
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-red-400">
                  <WifiOff className="w-5 h-5" />
                  <span className="font-medium">Connection Error</span>
                </div>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* Invite Link Section */}
          {isHost && shareableLink && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-300">Invite Link</h3>
              <div className="space-y-2">
                <Input
                  value={shareableLink}
                  readOnly
                  className="bg-gray-800 border-gray-700 text-gray-300 text-xs"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={copyInviteLink}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {copied ? 'Copied!' : 'Copy Link'}
                  </Button>
                  {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <Button
                      onClick={shareInviteLink}
                      variant="outline"
                      size="sm"
                    >
                      <Share className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    onClick={() => window.open(shareableLink, '_blank')}
                    variant="outline"
                    size="sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Players List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">Players ({connectedPlayers.length}/{requiredPlayers})</h3>
              <Badge variant={allPlayersConnected ? "default" : "secondary"} className="text-xs">
                {allPlayersConnected ? "Ready" : "Waiting"}
              </Badge>
            </div>

            <div className="space-y-2">
              {/* Show all connected players (host is already included in connectedPlayers) */}
              {connectedPlayers.map((player, index) => (
                <PlayerCard
                  key={player.pubkey}
                  pubkey={player.pubkey}
                  isHost={player.pubkey === hostPubkey}
                  connected={true}
                />
              ))}

              {/* Empty slots */}
              {Array.from({ length: requiredPlayers - connectedPlayers.length }).map((_, index) => (
                <div key={`empty-${index}`} className="flex items-center gap-3 p-3 border border-dashed border-gray-700 rounded-lg bg-gray-800/50">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                    <span className="text-xs text-gray-500">?</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-gray-500">Waiting for player...</div>
                  </div>
                  <div className="text-xs text-gray-600">
                    <WifiOff className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          {canStartGame && onStartGame && (
            <Button
              onClick={onStartGame}
              className="w-full"
              size="lg"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Game
            </Button>
          )}

          {/* Join Game button for non-host users */}
          {!isHost && canJoinGame && onJoinGame && (
            <div className="space-y-3">
              <Button
                onClick={onJoinGame}
                disabled={isJoining}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                {isJoining ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Joining Game...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Join Game
                  </>
                )}
              </Button>
              <div className="text-center">
                <p className="text-xs text-gray-400">
                  Host is ready! Click to join the multiplayer session.
                </p>
                {connectionState && (
                  <p className="text-xs text-blue-400 mt-1">
                    Connection: {connectionState}
                  </p>
                )}
              </div>
            </div>
          )}

          {status === 'full' && !isHost && !canJoinGame && (
            <div className="text-center">
              <p className="text-sm text-gray-400">
                Waiting for host to start the game...
              </p>
            </div>
          )}

          {/* Connection status for debugging */}
          {connectionState && connectionState !== 'new' && (
            <div className="text-center">
              <p className="text-xs text-blue-400">
                WebRTC Status: {connectionState}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface PlayerCardProps {
  pubkey: string;
  isHost: boolean;
  connected: boolean;
}

function PlayerCard({ pubkey, isHost, connected }: PlayerCardProps) {
  const { data: author } = useAuthor(pubkey);
  const displayName = author?.metadata?.name || pubkey.substring(0, 8);
  const avatar = author?.metadata?.picture;

  return (
    <div className="flex items-center gap-3 p-3 border border-gray-700 rounded-lg bg-gray-800">
      <div className="relative">
        {avatar ? (
          <img
            src={avatar}
            alt={displayName}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
            <span className="text-xs text-white font-medium">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        {isHost && (
          <Crown className="w-3 h-3 text-yellow-400 absolute -top-1 -right-1" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white font-medium truncate">
            {displayName}
          </span>
          {isHost && (
            <Badge variant="outline" className="text-xs border-yellow-600 text-yellow-400">
              Host
            </Badge>
          )}
        </div>
        <div className="text-xs text-gray-400">
          {pubkey.substring(0, 8)}...
        </div>
      </div>

      <div className="text-xs">
        {connected ? (
          <Wifi className="w-4 h-4 text-green-400" />
        ) : (
          <WifiOff className="w-4 h-4 text-gray-600" />
        )}
      </div>
    </div>
  );
}