import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gamepad2 } from 'lucide-react';

interface GameControlsProps {
  className?: string;
  variant?: 'card' | 'floating';
}

const controlMappings = [
  { keys: ['↑', '↓', '←', '→'], action: 'D-Pad', description: 'Movement' },
  { keys: ['Enter'], action: 'Start', description: 'Pause/Menu' },
  { keys: ['Shift'], action: 'Select', description: 'Select' },
  { keys: ['Z'], action: 'B Button', description: 'Action/Back' },
  { keys: ['X'], action: 'A Button', description: 'Action/Confirm' },
];

export default function GameControls({ className, variant = 'card' }: GameControlsProps) {
  const content = (
    <>
      <div className="flex items-center gap-2 mb-4">
        <Gamepad2 className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">Keyboard Controls</h3>
      </div>
      
      <div className="space-y-3">
        {controlMappings.map((control, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {control.keys.map((key, keyIndex) => (
                <Badge
                  key={keyIndex}
                  variant="outline"
                  className="bg-gray-800 border-gray-600 text-gray-300 font-mono text-xs px-2 py-1"
                >
                  {key}
                </Badge>
              ))}
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-white">{control.action}</div>
              <div className="text-xs text-gray-400">{control.description}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-800">
        <p className="text-xs text-gray-500">
          Controls work when the game area is focused. Click on the game to activate.
        </p>
      </div>
    </>
  );

  if (variant === 'floating') {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <Card className="border-gray-800 bg-gray-900/95 backdrop-blur-sm shadow-lg max-w-sm">
          <CardContent className="p-4">
            {content}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card className={`border-gray-800 bg-gray-900 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <Gamepad2 className="w-5 h-5" />
          Keyboard Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="space-y-3">
          {controlMappings.map((control, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {control.keys.map((key, keyIndex) => (
                  <Badge
                    key={keyIndex}
                    variant="outline"
                    className="bg-gray-800 border-gray-600 text-gray-300 font-mono text-xs px-2 py-1"
                  >
                    {key}
                  </Badge>
                ))}
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-white">{control.action}</div>
                <div className="text-xs text-gray-400">{control.description}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-gray-800">
          <p className="text-xs text-gray-500">
            Controls work when the game area is focused. Click on the game to activate.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}