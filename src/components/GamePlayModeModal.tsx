import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Users, User, Gamepad2 } from 'lucide-react';

interface GamePlayModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSinglePlayer: () => void;
  onMultiplayer: () => void;
  gameTitle: string;
}

export default function GamePlayModeModal({
  isOpen,
  onClose,
  onSinglePlayer,
  onMultiplayer,
  gameTitle
}: GamePlayModeModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-800 text-white">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold text-white">
              Choose how you want to play
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <DialogDescription className="text-gray-400">
            This game supports multiplayer. Would you like to play solo or join a multiplayer room?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Game info */}
          <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
            <Gamepad2 className="w-8 h-8 text-purple-400" />
            <div>
              <p className="font-medium text-white">{gameTitle}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="bg-purple-900 text-purple-300 border-purple-700">
                  <Users className="w-3 h-3 mr-1" />
                  Multiplayer Supported
                </Badge>
              </div>
            </div>
          </div>

          {/* Play mode options */}
          <div className="space-y-3">
            {/* Single Player Option */}
            <Button
              variant="outline"
              onClick={onSinglePlayer}
              className="w-full h-auto p-4 bg-gray-800 border-gray-700 hover:bg-gray-700 hover:border-purple-500 text-left justify-start"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-white text-lg">Single Player</h4>
                  <p className="text-gray-400 text-sm">Play alone at your own pace</p>
                </div>
              </div>
            </Button>

            {/* Multiplayer Option */}
            <Button
              variant="outline"
              onClick={onMultiplayer}
              className="w-full h-auto p-4 bg-gray-800 border-gray-700 hover:bg-gray-700 hover:border-purple-500 text-left justify-start"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-white text-lg">Multiplayer</h4>
                  <p className="text-gray-400 text-sm">Join or create a room with other players</p>
                </div>
              </div>
            </Button>
          </div>

          {/* Cancel button */}
          <div className="flex justify-center pt-2">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}