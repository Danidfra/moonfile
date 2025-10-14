import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import { Separator } from '@/components/ui/separator';
import {
  MessageCircle,
  // Trophy,
  Users,
  Send,
  // Zap,
  // Clock,
  // Target,
  // Gamepad2,
  // Heart
} from 'lucide-react';

type GameInteractionCardProps = {
  challengeStarted?: boolean; // defaults to false
};

export default function GameInteractionCard({ challengeStarted = false }: GameInteractionCardProps) {
  // If challenge hasn't started, don't render anything
  if (!challengeStarted) return null;

  // const [selectedChallenge, setSelectedChallenge] = useState('highest-score');
  // const [wagerAmount, setWagerAmount] = useState('');
  const [message, setMessage] = useState('');

  // Mock chat messages
  const chatMessages = [
    { user: 'Player1', message: 'Anyone up for a highest score challenge?', time: '2m ago' },
    { user: 'GamerPro', message: 'I\'m in! Let\'s do 1000 sats', time: '1m ago' },
    { user: 'RetroKing', message: 'I\'ll join but I prefer survival mode', time: '30s ago' },
    { user: 'SpeedRunner', message: 'Custom challenge sounds interesting!', time: 'Just now' },
  ];

  // const challengeTypes = [
  //   {
  //     id: 'highest-score',
  //     icon: <Trophy className="w-4 h-4" />,
  //     title: 'Highest Score',
  //     emoji: '🏆',
  //     description: 'Compete for the highest score in a single session. Best score wins the pot!'
  //   },
  //   {
  //     id: 'survival',
  //     icon: <Clock className="w-4 h-4" />,
  //     title: 'Survival',
  //     emoji: '🕹️',
  //     description: 'See who can survive the longest. Last player standing takes all!'
  //   },
  //   {
  //     id: 'custom',
  //     icon: <Target className="w-4 h-4" />,
  //     title: 'Custom Challenge',
  //     emoji: '🧪',
  //     description: 'Create your own rules and objectives. Perfect for unique gameplay styles!'
  //   },
  //   {
  //     id: 'casual',
  //     icon: <Gamepad2 className="w-4 h-4" />,
  //     title: 'Casual Match',
  //     emoji: '🎯',
  //     description: 'Play for fun without any wagers. Just friendly competition!'
  //   }
  // ];

  return (
    <div className="space-y-6">
      {/* Challenge Chat Panel */}
      <Card className="border-gray-800 bg-gray-900">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2 text-lg">
              <MessageCircle className="w-5 h-5" />
              Challenge Chat
            </CardTitle>
            <Badge variant="secondary" className="bg-green-900 text-green-300 border-green-700">
              <Users className="w-3 h-3 mr-1" />
              128 online
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {/* Chat Messages */}
          <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
            {chatMessages.map((msg, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-purple-400">{msg.user}</span>
                  <span className="text-gray-500">{msg.time}</span>
                </div>
                <p className="text-sm text-gray-300 bg-gray-800 rounded p-2">{msg.message}</p>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div className="flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-gray-800 border-gray-700 text-white placeholder-gray-500"
            />
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
              disabled={!message.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Challenge Setup & Bet Options */}
      {/*
      <Card className="border-gray-800 bg-gray-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2 text-lg">
            <Trophy className="w-5 h-5" />
            Challenge Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <Tabs value={selectedChallenge} onValueChange={setSelectedChallenge} className="w-full">
            <TabsList className="grid grid-cols-2 w-full bg-gray-800 mb-4">
              <TabsTrigger
                value="highest-score"
                className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-300"
              >
                🏆 Highest Score
              </TabsTrigger>
              <TabsTrigger
                value="survival"
                className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-300"
              >
                🕹️ Survival
              </TabsTrigger>
              <TabsTrigger
                value="custom"
                className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-300"
              >
                🧪 Custom
              </TabsTrigger>
              <TabsTrigger
                value="casual"
                className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-300"
              >
                🎯 Casual
              </TabsTrigger>
            </TabsList>

            {challengeTypes.map((challenge) => (
              <TabsContent key={challenge.id} value={challenge.id} className="space-y-4">
                <div className="flex items-center gap-2 text-white">
                  {challenge.icon}
                  <span className="font-semibold">{challenge.emoji} {challenge.title}</span>
                </div>

                <p className="text-sm text-gray-400">{challenge.description}</p>

                <Separator className="bg-gray-800" />

                // Wager Section
                {challenge.id !== 'casual' ? (
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-300">
                      Wager Amount
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={wagerAmount}
                        onChange={(e) => setWagerAmount(e.target.value)}
                        placeholder="Enter sats..."
                        className="bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                      />
                      <Button variant="outline" size="sm" className="bg-gray-800 border-gray-700 text-gray-300">
                        <Zap className="w-4 h-4 mr-1" />
                        Max
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-800 rounded p-3 text-center">
                    <Heart className="w-6 h-6 text-red-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No wager required - just for fun!</p>
                  </div>
                )}

                //Player Options
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-300">
                    Players
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-gray-800 border-gray-700 text-gray-300"
                    >
                      <Users className="w-4 h-4 mr-1" />
                      Invite Players
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-gray-800 border-gray-700 text-gray-300"
                    >
                      Find Match
                    </Button>
                  </div>
                </div>

                //Action Button
                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  disabled={challenge.id !== 'casual' && !wagerAmount}
                >
                  {challenge.id === 'casual' ? 'Start Casual Match' : 'Create Challenge'}
                </Button>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
     */}
    </div>
  );
}