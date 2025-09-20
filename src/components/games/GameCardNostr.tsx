import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Star, Download } from "lucide-react";
import type { Game31985 } from "@/types/game";

interface GameCardNostrProps {
  game: Game31985;
  onPlay?: () => void;
}

export function GameCardNostr({ game, onPlay }: GameCardNostrProps) {
  const coverImage = game.assets.cover || game.assets.icon || game.assets.banner;

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "released": return "bg-green-600";
      case "beta": return "bg-blue-600";
      case "alpha": return "bg-orange-600";
      case "prototype": return "bg-gray-600";
      default: return "bg-gray-600";
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return null;
    const sizes = ["B", "KB", "MB", "GB"];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < sizes.length - 1) {
      size /= 1024;
      i++;
    }
    return `${Math.round(size * 100) / 100} ${sizes[i]}`;
  };

  return (
    <Card className="group overflow-hidden border-gray-800 bg-gray-900 hover:border-purple-500 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/30">
      <div className="relative aspect-video overflow-hidden">
        {coverImage ? (
          <img 
            src={coverImage} 
            alt={game.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900/20 to-cyan-900/20 flex items-center justify-center">
            <div className="w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center">
              <Play className="w-8 h-8 text-gray-600" />
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute top-2 left-2 right-2 flex gap-2">
          {game.status && (
            <Badge className={`${getStatusColor(game.status)} text-white text-xs px-2 py-1 rounded-full`}>
              {game.status}
            </Badge>
          )}
          {game.version && (
            <Badge variant="outline" className="bg-black/50 border-gray-600 text-white text-xs">
              v{game.version}
            </Badge>
          )}
        </div>
        <div className="absolute bottom-2 left-2 right-2">
          {game.genres.length > 0 && (
            <Badge className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white text-xs px-2 py-1 rounded-full">
              {game.genres[0]}
            </Badge>
          )}
        </div>
      </div>
      
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg text-white mb-2 line-clamp-1">{game.title}</h3>
        {game.summary && (
          <p className="text-gray-400 text-sm mb-3 line-clamp-2">{game.summary}</p>
        )}
        
        <div className="flex flex-wrap gap-1 mb-3">
          {game.platforms.slice(0, 2).map((platform) => (
            <Badge 
              key={platform} 
              variant="outline" 
              className="text-xs border-gray-700 text-gray-300"
            >
              {platform}
            </Badge>
          ))}
          {game.platforms.length > 2 && (
            <Badge variant="outline" className="text-xs border-gray-700 text-gray-300">
              +{game.platforms.length - 2}
            </Badge>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-0 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {game.sizeBytes && (
            <span>{formatSize(game.sizeBytes)}</span>
          )}
          {game.sha256 && (
            <span className="font-mono">{game.sha256.slice(0, 8)}</span>
          )}
        </div>
        
        <Button 
          onClick={onPlay}
          size="sm"
          className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/50"
        >
          <Play className="w-3 h-3 mr-1" />
          Play
        </Button>
      </CardFooter>
    </Card>
  );
}