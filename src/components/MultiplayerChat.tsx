import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageCircle,
  Users,
  Send,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  user: string;
  message: string;
  time: string;
  avatar?: string;
  isCurrentUser?: boolean;
}

interface MultiplayerChatProps {
  className?: string;
  onlineCount?: number;
  currentUser?: string;
  onSendMessage?: (message: string) => void;
  messages?: ChatMessage[];
  isHost?: boolean;
}

export default function MultiplayerChat({
  className,
  onlineCount = 0,
  currentUser = 'You',
  onSendMessage,
  messages = [],
  isHost = false
}: MultiplayerChatProps) {
  const [message, setMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Mock messages for demo
  const mockMessages: ChatMessage[] = [
    {
      id: '1',
      user: 'Player1',
      message: 'Ready to play!',
      time: '2m ago',
      isCurrentUser: false
    },
    {
      id: '2',
      user: 'GamerPro',
      message: 'This game is awesome!',
      time: '1m ago',
      isCurrentUser: false
    },
    {
      id: '3',
      user: currentUser,
      message: 'Let\'s start the session',
      time: '30s ago',
      isCurrentUser: true
    },
    {
      id: '4',
      user: 'RetroKing',
      message: 'Good luck everyone!',
      time: 'Just now',
      isCurrentUser: false
    },
  ];

  const displayMessages = messages.length > 0 ? messages : mockMessages;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [displayMessages]);

  const handleSendMessage = () => {
    if (!message.trim()) return;

    if (onSendMessage) {
      onSendMessage(message);
    } else {
      // Mock sending message
      console.log('Sending message:', message);
    }

    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className={`border-gray-800 bg-gray-900 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2 text-lg">
            <MessageCircle className="w-5 h-5" />
            {isHost ? 'Host Chat' : 'Player Chat'}
          </CardTitle>
          {onlineCount > 0 && (
            <Badge variant="secondary" className="bg-green-900 text-green-300 border-green-700">
              <Users className="w-3 h-3 mr-1" />
              {onlineCount} online
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        {/* Chat Messages */}
        <ScrollArea className="h-64 w-full" ref={scrollAreaRef}>
          <div className="space-y-3 pr-4">
            {displayMessages.map((msg) => (
              <div key={msg.id} className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <Avatar className="w-5 h-5">
                    <AvatarImage src={msg.avatar} />
                    <AvatarFallback className="text-xs bg-gray-700 text-gray-300">
                      {msg.user.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className={`font-semibold ${
                    msg.isCurrentUser ? 'text-purple-400' : 'text-blue-400'
                  }`}>
                    {msg.user}
                  </span>
                  <span className="text-gray-500">{msg.time}</span>
                </div>
                <div className={`text-sm rounded-lg p-2 ml-7 ${
                  msg.isCurrentUser
                    ? 'bg-purple-900/50 text-purple-100'
                    : 'bg-gray-800 text-gray-300'
                }`}>
                  {msg.message}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Chat Input */}
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="flex-1 bg-gray-800 border-gray-700 text-white placeholder-gray-500"
            maxLength={500}
          />
          <Button
            onClick={handleSendMessage}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700"
            disabled={!message.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Chat Info */}
        <div className="text-xs text-gray-500">
          <p>Press Enter to send • Shift+Enter for new line</p>
        </div>
      </CardContent>
    </Card>
  );
}