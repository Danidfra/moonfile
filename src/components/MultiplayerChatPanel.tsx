import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useAuthor } from '@/hooks/useAuthor';
import {
  MessageCircle,
  Users,
  Send,
  ChevronDown,
  ChevronUp,
  Minimize2,
  Maximize2,
  Crown
} from 'lucide-react';

interface ChatMessage {
  id: string;
  user: string;
  message: string;
  time: string;
  isSystem?: boolean;
}

interface ConnectedPlayer {
  pubkey: string;
  signal?: string;
}

interface MultiplayerChatPanelProps {
  gameTitle: string;
  roomId: string;
  connectedPlayers: ConnectedPlayer[];
  hostPubkey: string;
  className?: string;
}

export default function MultiplayerChatPanel({
  gameTitle,
  roomId,
  connectedPlayers,
  hostPubkey,
  className = ""
}: MultiplayerChatPanelProps) {
  const [message, setMessage] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);

  // Mock chat messages
  const chatMessages: ChatMessage[] = [
    { id: '1', user: 'System', message: 'Welcome to the multiplayer room!', time: 'Just now', isSystem: true },
    { id: '2', user: 'SpeedRunner', message: 'Let\'s do this! I\'m warmed up and ready', time: '45s ago' },
  ];

  const handleSendMessage = () => {
    if (message.trim()) {
      // In a real implementation, this would send the message
      setMessage('');
    }
  };

  const getStatusColor = () => {
    // All connected players are considered online
    return 'bg-green-500';
  };

  const getStatusText = () => {
    // All connected players are considered online
    return 'Online';
  };

  if (isMinimized) {
    return (
      <Card className={`border-gray-800 bg-gray-900 ${className}`}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-white font-medium">Multiplayer Chat</span>
              <Badge variant="secondary" className="bg-green-900 text-green-300 border-green-700">
                {connectedPlayers.length} online
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(false)}
              className="text-gray-400 hover:text-white"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-gray-800 bg-gray-900 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-purple-400" />
            <CardTitle className="text-white text-lg">
              Multiplayer Room: {gameTitle}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-green-900 text-green-300 border-green-700">
              <Users className="w-3 h-3 mr-1" />
              {connectedPlayers.length} online
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(true)}
              className="text-gray-400 hover:text-white"
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          Room ID: {roomId}
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0 space-y-4">
        {/* Connected Players */}
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Connected Players</h4>
          <div className="space-y-2">
            {connectedPlayers.map((player) => (
              <ConnectedPlayerItem
                key={player.pubkey}
                pubkey={player.pubkey}
                isHost={player.pubkey === hostPubkey}
              />
            ))}
            {connectedPlayers.length === 0 && (
              <div className="text-xs text-gray-500 text-center py-2">
                No players connected yet
              </div>
            )}
          </div>
        </div>

        <Separator className="bg-gray-800" />

        {/* Chat Messages */}
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Chat</h4>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {chatMessages.map((msg) => (
              <div key={msg.id} className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className={`font-semibold ${msg.isSystem ? 'text-blue-400' : 'text-purple-400'}`}>
                    {msg.user}
                  </span>
                  <span className="text-gray-500">{msg.time}</span>
                </div>
                <p className={`text-sm ${msg.isSystem ? 'text-blue-300 bg-blue-900/20' : 'text-gray-300 bg-gray-800'} rounded p-2`}>
                  {msg.message}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Input */}
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-gray-800 border-gray-700 text-white placeholder-gray-500"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSendMessage();
              }
            }}
          />
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700"
            disabled={!message.trim()}
            onClick={handleSendMessage}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface ConnectedPlayerItemProps {
  pubkey: string;
  isHost: boolean;
}

function ConnectedPlayerItem({ pubkey, isHost }: ConnectedPlayerItemProps) {
  const { data: author } = useAuthor(pubkey);
  const displayName = author?.metadata?.name || `${pubkey.substring(0, 8)}...`;
  const avatar = author?.metadata?.picture;

  return (
    <div className="flex items-center gap-2">
      <Avatar className="w-6 h-6">
        {avatar ? (
          <AvatarImage src={avatar} alt={displayName} />
        ) : (
          <AvatarFallback className="text-xs bg-purple-600 text-white">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        )}
      </Avatar>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-sm text-gray-300 truncate">{displayName}</span>
        {isHost && (
          <Crown className="w-3 h-3 text-yellow-400 flex-shrink-0" />
        )}
      </div>
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-full bg-green-500"></div>
        <span className="text-xs text-gray-500">Online</span>
      </div>
    </div>
  );
}