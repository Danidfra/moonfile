import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MessageCircle, Trophy } from 'lucide-react';

export default function GameInteractionCard() {
  return (
    <Card className="border-gray-800 bg-gray-900">
      <CardHeader className="pb-4">
        <CardTitle className="text-white flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          <Trophy className="w-5 h-5" />
          Multiplayer & Bets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Multiplayer Chat Section */}
        <div>
          <h3 className="text-md font-bold mb-2 text-white flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Multiplayer Chat
          </h3>
          <div className="border border-gray-700 rounded p-3 bg-gray-800 text-gray-400 text-sm">
            <p className="mb-3">This will be a real-time chat for players…</p>
            <input
              disabled
              className="w-full p-2 text-xs bg-gray-700 border border-gray-600 rounded text-gray-500 placeholder-gray-500"
              placeholder="Chat coming soon..."
            />
          </div>
        </div>

        <Separator className="bg-gray-800" />

        {/* Challenge & Bets Section */}
        <div>
          <h3 className="text-md font-bold mb-3 text-white flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Challenge & Bets
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            You'll soon be able to compete with others in async or live challenges — with or without sats.
          </p>
          <div className="flex gap-2">
            <Button variant="default" size="sm" className="flex-1">
              Start Challenge
            </Button>
            <Button variant="secondary" size="sm" className="flex-1">
              Place Bet
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}