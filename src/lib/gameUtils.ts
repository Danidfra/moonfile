import type { NostrEvent } from '@jsr/nostrify__nostrify';

/**
 * Utility functions for game-related operations
 */

/**
 * Checks if a game event has multiplayer mode enabled
 * @param event - The Nostr event (kind 31996) to check
 * @returns true if the game has ["mode", "multiplayer"] tag
 */
export function isMultiplayerGame(event: NostrEvent): boolean {
  return event.tags.some(tag => 
    tag.length >= 2 && 
    tag[0] === 'mode' && 
    tag[1] === 'multiplayer'
  );
}

/**
 * Get all game modes from a game event
 * @param event - The Nostr event (kind 31996) to check
 * @returns Array of mode strings
 */
export function getGameModes(event: NostrEvent): string[] {
  return event.tags
    .filter(tag => tag[0] === 'mode' && tag[1])
    .map(tag => tag[1]);
}

/**
 * Check if a game supports a specific mode
 * @param event - The Nostr event (kind 31996) to check
 * @param mode - The mode to check for (e.g., 'multiplayer', 'singleplayer')
 * @returns true if the game supports the specified mode
 */
export function hasGameMode(event: NostrEvent, mode: string): boolean {
  return event.tags.some(tag => 
    tag.length >= 2 && 
    tag[0] === 'mode' && 
    tag[1] === mode
  );
}