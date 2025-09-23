import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Wifi, WifiOff, Crown, Loader2, Play } from 'lucide-react';
import { useAuthor } from '@/hooks/useAuthor';

interface PlayerInfo {
  pubkey: string;
  connected: boolean;
  isHost: boolean;
  signal?: string;
}

interface MultiplayerWaitingScreenProps {
  status: 'waiting' | 'connecting' | 'ready' | 'error';
  players: PlayerInfo[];
  requiredPlayers: number;
  isHost: boolean;
  onStartGame?: () => void;
  error?: string;
  className?: string;
}

export default function MultiplayerWaitingScreen({
  status,
  players,
  requiredPlayers,
  isHost,
  onStartGame,
  error,
  className = ""
}: MultiplayerWaitingScreenProps) {
  const connectedPlayers = players.filter(p => p.connected);
  const allPlayersConnected = connectedPlayers.length >= requiredPlayers;

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

            {status === 'connecting' && (
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

            {status === 'ready' && (
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

          {/* Players List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">Players ({connectedPlayers.length}/{requiredPlayers})</h3>
              <Badge variant={allPlayersConnected ? "default" : "secondary"} className="text-xs">
                {allPlayersConnected ? "Ready" : "Waiting"}
              </Badge>
            </div>

            <div className="space-y-2">
              {players.map((player, index) => (
                <PlayerCard key={player.pubkey} player={player} />
              ))}
              
              {/* Empty slots */}
              {Array.from({ length: requiredPlayers - players.length }).map((_, index) => (
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

          {/* Action Button */}
          {status === 'ready' && isHost && onStartGame && (
            <Button 
              onClick={onStartGame} 
              className="w-full" 
              size="lg"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Game
            </Button>
          )}

          {status === 'ready' && !isHost && (
            <div className="text-center">
              <p className="text-sm text-gray-400">
                Waiting for host to start the game...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface PlayerCardProps {
  player: PlayerInfo;
}

function PlayerCard({ player }: PlayerCardProps) {
  const { data: author } = useAuthor(player.pubkey);
  const displayName = author?.metadata?.name || player.pubkey.substring(0, 8);
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
        {player.isHost && (
          <Crown className="w-3 h-3 text-yellow-400 absolute -top-1 -right-1" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white font-medium truncate">
            {displayName}
          </span>
          {player.isHost && (
            <Badge variant="outline" className="text-xs border-yellow-600 text-yellow-400">
              Host
            </Badge>
          )}
        </div>
        <div className="text-xs text-gray-400">
          {player.pubkey.substring(0, 8)}...
        </div>
      </div>
      
      <div className="text-xs">
        {player.connected ? (
          <Wifi className="w-4 h-4 text-green-400" />
        ) : (
          <WifiOff className="w-4 h-4 text-gray-600" />
        )}
      </div>
    </div>
  );
}