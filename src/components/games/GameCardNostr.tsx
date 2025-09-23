import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Image as ImageIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import GamePlayModeModal from "@/components/GamePlayModeModal";
import type { Game31996 } from "@/types/game";

interface GameCardNostrProps {
  game: Game31996;
}

export function GameCardNostr({ game }: GameCardNostrProps) {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);
  const [showPlayModeModal, setShowPlayModeModal] = useState(false);

  // Get cover image with fallbacks -优先级: cover > icon > banner
  const coverImage = game.assets.cover || game.assets.icon || game.assets.banner;
  const hasImage = coverImage && !imageError;

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

  const handleImageError = () => {
    console.warn(`Failed to load image for game "${game.title}": ${coverImage}`);
    setImageError(true);
  };

  // Validate image URL format
  const isValidImageUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const shouldShowImage = hasImage && isValidImageUrl(coverImage);

  // Check if game supports multiplayer
  const isMultiplayer = game.modes.some(mode =>
    ['multiplayer', 'co-op', 'competitive'].includes(mode.toLowerCase())
  );

  // Generate temporary room ID
  const generateRoomId = () => {
    return `room_${Math.random().toString(36).substr(2, 9)}_${Date.now().toString(36).substr(6, 4)}`;
  };

  const handlePlayClick = () => {
    if (isMultiplayer) {
      setShowPlayModeModal(true);
    } else {
      navigate(`/game/${game.id}`);
    }
  };

  const handleSinglePlayer = () => {
    setShowPlayModeModal(false);
    navigate(`/game/${game.id}`);
  };

  const handleMultiplayer = () => {
    setShowPlayModeModal(false);
    const roomId = generateRoomId();
    navigate(`/multiplayer/${game.id}/${roomId}`);
  };

  return (
    <Card className="group overflow-hidden border-gray-800 bg-gray-900 hover:border-purple-500 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/30">
      <div className="relative aspect-video overflow-hidden bg-gray-800">
        {shouldShowImage ? (
          <img
            src={coverImage}
            alt={`${game.title} cover art`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            onError={handleImageError}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900/30 via-gray-800/50 to-cyan-900/30 flex items-center justify-center relative overflow-hidden">
            {/* Animated background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="w-full h-full bg-repeat"
                   style={{
                     backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%239C92AC' fill-opacity='0.4'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")`,
                     backgroundSize: '40px 40px'
                   }} />
            </div>

            <div className="text-center relative z-10">
              <div className="w-20 h-20 bg-gray-700/50 rounded-xl flex items-center justify-center mb-3 mx-auto backdrop-blur-sm border border-gray-600/30 shadow-lg">
                <ImageIcon className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-400 text-sm font-medium mb-1">No Cover Image</p>
              <p className="text-gray-500 text-xs">Game image not available</p>
            </div>
          </div>
        )}

        {/* Overlay gradient for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        {/* Status and version badges */}
        <div className="absolute top-3 left-3 right-3 flex gap-2 flex-wrap">
          {game.status && (
            <Badge className={`${getStatusColor(game.status)} text-white text-xs px-2.5 py-1 rounded-full font-medium shadow-lg backdrop-blur-sm`}>
              {game.status}
            </Badge>
          )}
          {game.version && (
            <Badge className="bg-black/60 border-gray-600 text-white text-xs px-2.5 py-1 rounded-full font-medium shadow-lg backdrop-blur-sm">
              v{game.version}
            </Badge>
          )}
        </div>

        {/* Genre badge */}
        <div className="absolute bottom-3 left-3 right-3">
          {game.genres.length > 0 && (
            <Badge className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white text-xs px-3 py-1.5 rounded-full font-medium shadow-lg backdrop-blur-sm">
              {game.genres[0]}
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-4">
        <h3 className="font-semibold text-lg text-white mb-2 line-clamp-1 group-hover:text-purple-400 transition-colors">
          {game.title}
        </h3>
        {game.summary && (
          <p className="text-gray-400 text-sm mb-3 line-clamp-2 leading-relaxed">
            {game.summary}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5 mb-3">
          {game.platforms.slice(0, 3).map((platform) => (
            <Badge
              key={platform}
              variant="outline"
              className="text-xs border-gray-700 text-gray-300 bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
            >
              {platform}
            </Badge>
          ))}
          {game.platforms.length > 3 && (
            <Badge
              variant="outline"
              className="text-xs border-gray-700 text-gray-300 bg-gray-800/50"
            >
              +{game.platforms.length - 3}
            </Badge>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {game.sizeBytes && (
            <span className="font-medium">{formatSize(game.sizeBytes)}</span>
          )}
          {game.sha256 && (
            <span className="font-mono text-xs bg-gray-800 px-2 py-1 rounded">
              {game.sha256.slice(0, 6)}…
            </span>
          )}
        </div>

        <Button
          onClick={handlePlayClick}
          size="sm"
          className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/50 px-4"
        >
          <Play className="w-3 h-3 mr-1.5" />
          Play
        </Button>
      </CardFooter>

      {/* Play Mode Modal */}
      <GamePlayModeModal
        isOpen={showPlayModeModal}
        onClose={() => setShowPlayModeModal(false)}
        onSinglePlayer={handleSinglePlayer}
        onMultiplayer={handleMultiplayer}
        gameTitle={game.title}
      />
    </Card>
  );
}