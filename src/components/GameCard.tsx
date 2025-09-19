import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

interface GameCardProps {
  title: string;
  genre: string;
  coverImage: string;
  onPlay?: () => void;
}

export function GameCard({ title, genre, coverImage, onPlay }: GameCardProps) {
  return (
    <Card className="group overflow-hidden border-gray-200 bg-white hover:border-purple-400 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-200">
      <div className="relative aspect-video overflow-hidden">
        <img
          src={coverImage}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-2 left-2 right-2">
          <span className="inline-block bg-purple-600 text-white text-xs px-2 py-1 rounded">
            {genre}
          </span>
        </div>
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg text-foreground mb-2">{title}</h3>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button
          onClick={onPlay}
          className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white transition-all duration-300"
        >
          <Play className="w-4 h-4 mr-2" />
          Play Now
        </Button>
      </CardFooter>
    </Card>
  );
}