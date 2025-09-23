import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  MessageCircle, 
  Users, 
  Send, 
  ChevronDown,
  ChevronUp,
  Minimize2,
  Maximize2
} from 'lucide-react';

interface ChatMessage {
  id: string;
  user: string;
  message: string;
  time: string;
  isSystem?: boolean;
}

interface ConnectedUser {
  id: string;
  username: string;
  status: 'online' | 'away' | 'playing';
}

interface MultiplayerChatPanelProps {
  gameTitle: string;
  roomId: string;
  className?: string;
}

export default function MultiplayerChatPanel({ 
  gameTitle, 
  roomId, 
  className = "" 
}: MultiplayerChatPanelProps) {
  const [message, setMessage] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);

  // Mock connected users
  const connectedUsers: ConnectedUser[] = [
    { id: '1', username: 'GameMaster', status: 'online' },
    { id: '2', username: 'SpeedRunner', status: 'playing' },
    { id: '3', username: 'RetroKing', status: 'online' },
    { id: '4', username: 'CasualGamer', status: 'away' },
    { id: '5', username: 'ProPlayer', status: 'online' },
  ];

  // Mock chat messages
  const chatMessages: ChatMessage[] = [
    { id: '1', user: 'System', message: 'Welcome to the multiplayer room!', time: 'Just now', isSystem: true },
    { id: '2', user: 'GameMaster', message: 'Hey everyone! Ready for some multiplayer action?', time: '1m ago' },
    { id: '3', user: 'SpeedRunner', message: 'Let\'s do this! I\'m warmed up and ready', time: '45s ago' },
    { id: '4', user: 'RetroKing', message: 'Anyone up for a cooperative run?', time: '30s ago' },
    { id: '5', user: 'CasualGamer', message: 'I\'ll join, but go easy on me 😅', time: '15s ago' },
    { id: '6', user: 'ProPlayer', message: 'Let\'s set some high scores together!', time: 'Just now' },
  ];

  const handleSendMessage = () => {
    if (message.trim()) {
      // In a real implementation, this would send the message
      setMessage('');
    }
  };

  const getStatusColor = (status: ConnectedUser['status']) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'playing': return 'bg-yellow-500';
      case 'away': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: ConnectedUser['status']) => {
    switch (status) {
      case 'online': return 'Online';
      case 'playing': return 'Playing';
      case 'away': return 'Away';
      default: return 'Offline';
    }
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
                {connectedUsers.length} online
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
              {connectedUsers.length} online
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
        {/* Connected Users */}
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Connected Players</h4>
          <div className="space-y-2">
            {connectedUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-2">
                <Avatar className="w-6 h-6">
                  <AvatarFallback className="text-xs bg-purple-600 text-white">
                    {user.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-gray-300 flex-1">{user.username}</span>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(user.status)}`}></div>
                  <span className="text-xs text-gray-500">{getStatusText(user.status)}</span>
                </div>
              </div>
            ))}
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