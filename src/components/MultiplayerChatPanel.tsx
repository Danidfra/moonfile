import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
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
  sender: string;
  message: string;
  timestamp: number;
  senderName?: string;
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
  chatMessages: ChatMessage[];
  isWebRTCConnected: boolean;
  onSendMessage: (message: string) => void;
  className?: string;
}

export default function MultiplayerChatPanel({
  gameTitle,
  roomId,
  connectedPlayers,
  hostPubkey,
  chatMessages,
  isWebRTCConnected,
  onSendMessage,
  className = ""
}: MultiplayerChatPanelProps) {
  const [message, setMessage] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);

  console.log('[ChatPanel] isWebRTCConnected:', isWebRTCConnected);
  console.log('[ChatPanel] connectedPlayers:', connectedPlayers);

  // Add debug useEffect to track prop changes
  useEffect(() => {
    console.log('[ChatPanel] Updated isWebRTCConnected:', isWebRTCConnected);
    console.log('[ChatPanel] Updated connectedPlayers:', connectedPlayers);
    console.log('[ChatPanel] Updated chatMessages:', chatMessages);
  }, [isWebRTCConnected, connectedPlayers, chatMessages]);

  const handleSendMessage = () => {
    if (message.trim() && isWebRTCConnected) {
      onSendMessage(message.trim());
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
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-300">Chat</h4>
            {!isWebRTCConnected && (
              <span className="text-xs text-yellow-400">Connecting...</span>
            )}
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {!isWebRTCConnected && (
              <div className="text-center text-sm text-gray-500 py-4">
                Chat will be available once WebRTC connection is established
              </div>
            )}
            {isWebRTCConnected && chatMessages.length === 0 && (
              <div className="text-center text-sm text-gray-500 py-4">
                No messages yet. Start the conversation!
              </div>
            )}
            {chatMessages.map((msg) => (
              <ChatMessageItem
                key={msg.id}
                message={msg}
                connectedPlayers={connectedPlayers}
                hostPubkey={hostPubkey}
              />
            ))}
          </div>
        </div>

        {/* Chat Input */}
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isWebRTCConnected ? "Type your message..." : "Waiting for connection..."}
            className="flex-1 bg-gray-800 border-gray-700 text-white placeholder-gray-500"
            disabled={!isWebRTCConnected}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSendMessage();
              }
            }}
          />
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700"
            disabled={!message.trim() || !isWebRTCConnected}
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
  const { user } = useCurrentUser();
  const displayName = author?.metadata?.name || `${pubkey.substring(0, 8)}...`;
  const avatar = author?.metadata?.picture;
  const isCurrentUser = user?.pubkey === pubkey;

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
        {isCurrentUser && (
          <Badge variant="outline" className="text-xs border-blue-600 text-blue-400 flex-shrink-0">
            You
          </Badge>
        )}
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

interface ChatMessageItemProps {
  message: ChatMessage;
  connectedPlayers: ConnectedPlayer[];
  hostPubkey: string;
}

function ChatMessageItem({ message, connectedPlayers, hostPubkey }: ChatMessageItemProps) {
  const { data: author } = useAuthor(message.sender);
  const senderName = author?.metadata?.name || `${message.sender.substring(0, 8)}...`;
  const isHost = message.sender === hostPubkey;

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-purple-400">
          {senderName}
        </span>
        {isHost && (
          <Crown className="w-3 h-3 text-yellow-400" />
        )}
        <span className="text-gray-500">{formatTime(message.timestamp)}</span>
      </div>
      <p className="text-sm text-gray-300 bg-gray-800 rounded p-2">
        {message.message}
      </p>
    </div>
  );
}