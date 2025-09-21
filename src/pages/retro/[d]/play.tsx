import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNostr } from '@nostrify/react';
import { RetroPlayer } from '@/components/retro/RetroPlayer';
import { ROMLoader, type ROMSource } from '@/lib/rom/romLoader';
import type { Game31996, NostrEvent } from '@/types/game';

export default function RetroPlayPage() {
  const { d } = useParams<{ d: string }>();
  const navigate = useNavigate();
  const { nostr } = useNostr();
  const [game, setGame] = useState<Game31996 | null>(null);
  const [romSource, setRomSource] = useState<ROMSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nostrEvent, setNostrEvent] = useState<NostrEvent | null>(null);

  // Mount/unmount logging
  useEffect(() => {
    console.log("[Retro] MOUNT: component mounted");
    return () => console.log("[Retro] UNMOUNT: component unmounted");
  }, []);

  useEffect(() => {
    const loadGameAndROM = async () => {
      if (!nostr || !d) return;

      try {
        console.log("[Retro] start loading flow");
        setLoading(true);
        setError(null);

        console.log("[Retro] fetching kind=31996 …");
        // Fetch the kind:31996 event by d-tag
        const events = await nostr.query([{
          kinds: [31996],
          '#d': [d],
          limit: 1
        }], {
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        if (events.length === 0) {
          console.log("[Retro] no events found for d:", d);
          setError('Game event not found');
          navigate('/games');
          return;
        }

        const event = events[0] as NostrEvent;
        console.log("[Retro] event ok:", event.id);
        setNostrEvent(event);

        console.log("[Retro] tags:", event.tags);

        // Content preview
        console.log("[Retro] content.start:", event.content?.slice(0, 100));
        console.log("[Retro] content.end:", event.content?.slice(-100));

        // Parse game metadata from event
        const parsedGame = parseGameFromEvent(event);
        setGame(parsedGame);

        // Phase 2: Load ROM from Nostr event content
        setRomSource({
          source: 'nostr',
          event: {
            content: event.content,
            tags: event.tags
          }
        });
        console.log("[Retro] romSource set, loading should start in RetroPlayer");
      } catch (err) {
        console.error('Failed to load game:', err);
        setError(err instanceof Error ? err.message : 'Failed to load game');
      } finally {
        setLoading(false);
      }
    };

    loadGameAndROM();
  }, [d, nostr, navigate]);

  // Fallback to Phase 1 URL loading if Nostr fails
  useEffect(() => {
    if (error && d && !romSource) {
      // Try to load from URL as fallback
      setRomSource({
        source: 'url',
        url: `/roms/${d}.nes`
      });
    }
  }, [error, d, romSource]);

  const handleBack = () => {
    navigate('/games');
  };

  const handleFullscreen = () => {
    // Custom fullscreen handling if needed
    // The RetroPlayer component has basic fullscreen support
  };

  const handleRetry = () => {
    // Retry loading
    setError(null);
    setLoading(true);
    setRomSource(null);
  };

  const handleCopyEventId = () => {
    if (nostrEvent) {
      navigator.clipboard.writeText(nostrEvent.id);
      // You could add a toast notification here
    }
  };

  const handleRunTestROM = () => {
    console.log("[Retro] Running Test ROM from error state");
    // Navigate to test ROM or set up test ROM loading
    setRomSource({
      source: 'url',
      url: '/roms/test-rom.nes'
    });
    setError(null); // Clear error so RetroPlayer can try to load
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-400 mb-4">Loading game from Nostr...</p>
          <button
            onClick={handleRunTestROM}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
          >
            Run Test ROM Instead
          </button>
        </div>
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-4">Error Loading Game</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
            <button
              onClick={handleRunTestROM}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Run Test ROM
            </button>
            {nostrEvent && (
              <button
                onClick={handleCopyEventId}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Copy Event ID
              </button>
            )}
            <button
              onClick={handleBack}
              className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 px-6 py-2 rounded-lg transition-colors"
            >
              Back to Games
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!game || !romSource) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-400 text-6xl mb-4">🎮</div>
          <h2 className="text-2xl font-bold text-white mb-4">Game Not Found</h2>
          <p className="text-gray-400 mb-6">
            The game you're looking for doesn't exist or couldn't be loaded.
          </p>
          <div className="space-y-3">
            <button
              onClick={handleRunTestROM}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Run Test ROM
            </button>
            <button
              onClick={handleBack}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Back to Games
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <RetroPlayer
      meta={game}
      romSource={romSource}
      nostrEvent={nostrEvent}
      onBack={handleBack}
      onFullscreen={handleFullscreen}
    />
  );
}

// Helper function to parse game metadata from Nostr event
function parseGameFromEvent(event: NostrEvent): Game31996 {
  console.log("[Retro] parsing game from event");
  const getTagValue = (tagName: string): string | undefined => {
    const tag = event.tags.find(t => t[0] === tagName);
    return tag?.[1];
  };

  const getTagValues = (tagName: string): string[] => {
    return event.tags
      .filter(t => t[0] === tagName)
      .map(t => t[1])
      .filter(Boolean);
  };

  const getAssetUrl = (assetType: string): string | undefined => {
    const tag = event.tags.find(t => t[0] === 'image' && t[1] === assetType);
    return tag?.[2];
  };

  const screenshots = event.tags
    .filter(t => t[0] === 'image' && t[1] === 'screenshot')
    .map(t => t[2])
    .filter(Boolean);

  return {
    id: getTagValue('d') || event.id,
    title: getTagValue('name') || 'Unknown Game',
    summary: getTagValue('summary'),
    genres: getTagValues('t').filter(t => !['singleplayer', 'multiplayer', 'co-op', 'competitive'].includes(t)),
    modes: getTagValues('t').filter(t => ['singleplayer', 'multiplayer', 'co-op', 'competitive'].includes(t)),
    status: getTagValue('status') as any,
    version: getTagValue('version'),
    credits: getTagValue('credits'),
    platforms: getTagValues('platform'),
    mime: getTagValue('mime'),
    encoding: getTagValue('encoding') as any,
    compression: getTagValue('compression') as any,
    sizeBytes: getTagValue('size') ? parseInt(getTagValue('size')!, 10) : undefined,
    sha256: getTagValue('sha256'),
    assets: {
      cover: getAssetUrl('cover'),
      icon: getAssetUrl('icon'),
      banner: getAssetUrl('banner'),
      screenshots
    },
    contentBase64: event.content,
    event
  };
}