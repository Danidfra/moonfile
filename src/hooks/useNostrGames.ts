import { useState, useEffect } from "react";
import { useNostr } from "@nostrify/react";
import type { Game31996, NostrEvent } from "@/types/game";
import { mergeByD } from "@/lib/gameParser";

export function useNostrGames() {
  const { nostr } = useNostr();
  const [games, setGames] = useState<Game31996[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGames = async () => {
    if (!nostr) return;

    try {
      setLoading(true);
      setError(null);

      const events = await nostr.query([
        {
          kinds: [31996],
          limit: 1000 // Optional: add limit to prevent overwhelming responses
        }
      ], {
        signal: new AbortController().signal // 10 second timeout
      });

      const parsedGames = mergeByD(events as NostrEvent[]);
      setGames(parsedGames);
    } catch (err) {
      console.error("Failed to fetch games:", err);
      setError("Couldn't load games. Check your relay connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (nostr) {
      fetchGames();
    }
  }, [nostr]);

  return {
    games,
    loading,
    error,
    refetch: fetchGames
  };
}