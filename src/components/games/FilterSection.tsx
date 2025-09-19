import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { 
  Filter, 
  X, 
  ChevronDown, 
  Star, 
  Search,
  Gamepad2,
  Users,
  Calendar,
  Monitor,
  Tag,
  User,
  Award
} from "lucide-react";

interface FilterSectionProps {
  onFiltersChange: (filters: GameFilters) => void;
}

export interface GameFilters {
  genres: string[];
  modes: string[];
  statuses: string[];
  platforms: string[];
  tags: string[];
  author: string;
  rating: number;
  search: string;
}

const GENRES = [
  "Puzzle", "Platformer", "Shooter", "Adventure", "Strategy", "RPG", 
  "Racing", "Sports", "Fighting", "Simulation", "Casino", "Card"
];

const MODES = [
  "Solo", "Bot", "PvP", "Co-op", "Multiplayer", "Local Multiplayer", 
  "Online Multiplayer", "Turn-based", "Real-time"
];

const STATUSES = [
  "Released", "Beta", "Alpha", "Prototype", "Early Access", "Cancelled"
];

const PLATFORMS = [
  "NES ROM", "HTML5", "SNES", "Game Boy", "Game Boy Advance", 
  "Genesis", "PlayStation", "PC", "Mobile", "WebGL", "Flash"
];

const TAGS = [
  "retro", "8-bit", "sokoban", "homebrew", "2D", "3D", "pixel-art",
  "roguelike", "metroidvania", "bullet-hell", "puzzle-platformer",
  "open-world", "text-based", "graphical", "multiplayer", "singleplayer",
  "competitive", "cooperative", "educational", "artistic", "experimental"
];

export function FilterSection({ onFiltersChange }: FilterSectionProps) {
  const [filters, setFilters] = useState<GameFilters>({
    genres: [],
    modes: [],
    statuses: [],
    platforms: [],
    tags: [],
    author: "",
    rating: 0,
    search: ""
  });

  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = (key: keyof GameFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const toggleArrayFilter = (key: keyof GameFilters, item: string) => {
    const currentArray = filters[key] as string[];
    const newArray = currentArray.includes(item)
      ? currentArray.filter(i => i !== item)
      : [...currentArray, item];
    updateFilter(key, newArray);
  };

  const clearAllFilters = () => {
    const clearedFilters: GameFilters = {
      genres: [],
      modes: [],
      statuses: [],
      platforms: [],
      tags: [],
      author: "",
      rating: 0,
      search: ""
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'author' || key === 'search') return value !== "";
    if (key === 'rating') return value > 0;
    return Array.isArray(value) && value.length > 0;
  });

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.author) count++;
    if (filters.rating > 0) count++;
    count += filters.genres.length;
    count += filters.modes.length;
    count += filters.statuses.length;
    count += filters.platforms.length;
    count += filters.tags.length;
    return count;
  };

  return (
    <Card className="border-gray-200 bg-white shadow-sm mb-8">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Filter className="w-5 h-5" />
            Filter Games
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2">
                {getActiveFilterCount()} active
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="text-gray-600 border-gray-300 hover:bg-gray-50"
              >
                <X className="w-4 h-4 mr-1" />
                Clear All
              </Button>
            )}
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-gray-600 border-gray-300 hover:bg-gray-50"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search games..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-10 bg-white border-gray-300 focus:border-purple-500"
          />
        </div>
      </CardHeader>

      <Collapsible open={isExpanded}>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Genre Filter */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Gamepad2 className="w-4 h-4 text-purple-600" />
                  <h3 className="font-semibold text-gray-800">Genre</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {GENRES.map((genre) => (
                    <Badge
                      key={genre}
                      variant={filters.genres.includes(genre) ? "default" : "outline"}
                      className={`cursor-pointer transition-colors ${
                        filters.genres.includes(genre)
                          ? "bg-purple-600 text-white hover:bg-purple-700"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                      onClick={() => toggleArrayFilter('genres', genre)}
                    >
                      {genre}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Mode Filter */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-cyan-600" />
                  <h3 className="font-semibold text-gray-800">Mode</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {MODES.map((mode) => (
                    <Badge
                      key={mode}
                      variant={filters.modes.includes(mode) ? "default" : "outline"}
                      className={`cursor-pointer transition-colors ${
                        filters.modes.includes(mode)
                          ? "bg-cyan-600 text-white hover:bg-cyan-700"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                      onClick={() => toggleArrayFilter('modes', mode)}
                    >
                      {mode}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <h3 className="font-semibold text-gray-800">Status</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((status) => (
                    <Badge
                      key={status}
                      variant={filters.statuses.includes(status) ? "default" : "outline"}
                      className={`cursor-pointer transition-colors ${
                        filters.statuses.includes(status)
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                      onClick={() => toggleArrayFilter('statuses', status)}
                    >
                      {status}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Platform Filter */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Monitor className="w-4 h-4 text-green-600" />
                  <h3 className="font-semibold text-gray-800">Platform</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((platform) => (
                    <Badge
                      key={platform}
                      variant={filters.platforms.includes(platform) ? "default" : "outline"}
                      className={`cursor-pointer transition-colors ${
                        filters.platforms.includes(platform)
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                      onClick={() => toggleArrayFilter('platforms', platform)}
                    >
                      {platform}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Tags Filter */}
              <div className="md:col-span-2">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-orange-600" />
                  <h3 className="font-semibold text-gray-800">Tags</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TAGS.map((tag) => (
                    <Badge
                      key={tag}
                      variant={filters.tags.includes(tag) ? "default" : "outline"}
                      className={`cursor-pointer transition-colors ${
                        filters.tags.includes(tag)
                          ? "bg-orange-600 text-white hover:bg-orange-700"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                      onClick={() => toggleArrayFilter('tags', tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Author and Rating */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-semibold text-gray-800">Author</h3>
                  </div>
                  <Input
                    placeholder="Developer name or npub..."
                    value={filters.author}
                    onChange={(e) => updateFilter('author', e.target.value)}
                    className="bg-white border-gray-300 focus:border-purple-500"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Award className="w-4 h-4 text-yellow-600" />
                    <h3 className="font-semibold text-gray-800">Minimum Rating</h3>
                  </div>
                  <Select 
                    value={filters.rating.toString()} 
                    onValueChange={(value) => updateFilter('rating', parseInt(value))}
                  >
                    <SelectTrigger className="bg-white border-gray-300 focus:border-purple-500">
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Any rating</SelectItem>
                      <SelectItem value="1">1+ stars</SelectItem>
                      <SelectItem value="2">2+ stars</SelectItem>
                      <SelectItem value="3">3+ stars</SelectItem>
                      <SelectItem value="4">4+ stars</SelectItem>
                      <SelectItem value="5">5 stars</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}