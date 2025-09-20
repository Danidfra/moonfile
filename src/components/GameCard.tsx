import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Star } from "lucide-react";

interface GameCardProps {
  title: string;
  genre: string;
  coverImage: string;
  rating?: number;
  onPlay?: () => void;
}

export function GameCard({ title, genre, coverImage, rating = 0, onPlay }: GameCardProps) {
  return (
    <Card className="group overflow-hidden border-gray-800 bg-gray-900 hover:border-purple-500 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/30">
      <div className="relative aspect-video overflow-hidden">
        <img
          src={coverImage}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute bottom-2 left-2 right-2">
          <span className="inline-block bg-gradient-to-r from-purple-600 to-cyan-600 text-white text-xs px-2 py-1 rounded-full">
            {genre}
          </span>
        </div>
        {rating > 0 && (
          <div className="absolute top-2 right-2 flex items-center bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full">
            <Star className="w-3 h-3 text-yellow-400 fill-current mr-1" />
            <span className="text-white text-xs font-medium">{rating}</span>
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg text-white mb-2">{title}</h3>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button
          onClick={onPlay}
          className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/50"
        >
          <Play className="w-4 h-4 mr-2" />
          Play Now
        </Button>
      </CardFooter>
    </Card>
  );
}