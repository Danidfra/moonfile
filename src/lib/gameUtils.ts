import type { NostrEvent } from '@jsr/nostrify__nostrify';

/**
 * Utility functions for game-related operations
 */

/**
 * Get the MIME type from a game event
 * @param event - The Nostr event (kind 31996) to check
 * @returns MIME type string, defaults to 'application/x-nes-rom'
 */
export function getGameMimeType(event: NostrEvent): string {
  const mimeTag = event.tags.find(tag => tag[0] === 'mime');
  return mimeTag?.[1] || 'application/x-nes-rom';
}

/**
 * Get the system name from a MIME type
 * @param mimeType - The MIME type string
 * @returns Human-readable system name
 */
export function getSystemNameFromMimeType(mimeType: string): string {
  const systemNames: Record<string, string> = {
    'application/x-nes-rom': 'Nintendo Entertainment System',
    'application/x-nintendo-nes-rom': 'Nintendo Entertainment System',
    'application/x-snes-rom': 'Super Nintendo Entertainment System',
    'application/x-nintendo-snes-rom': 'Super Nintendo Entertainment System',
    'application/x-gameboy-rom': 'Game Boy',
    'application/x-gameboy-color-rom': 'Game Boy Color',
    'application/x-nintendo-gameboy-rom': 'Game Boy',
    'application/x-gba-rom': 'Game Boy Advance',
    'application/x-gameboy-advance-rom': 'Game Boy Advance',
    'application/x-nintendo-gba-rom': 'Game Boy Advance',
    'application/x-n64-rom': 'Nintendo 64',
    'application/x-nintendo-64-rom': 'Nintendo 64',
    'application/x-genesis-rom': 'Sega Genesis',
    'application/x-megadrive-rom': 'Sega Mega Drive',
    'application/x-sega-genesis-rom': 'Sega Genesis',
    'application/x-sms-rom': 'Sega Master System',
    'application/x-master-system-rom': 'Sega Master System',
    'application/x-gamegear-rom': 'Sega Game Gear',
    'application/x-sega-gamegear-rom': 'Sega Game Gear',
    'application/x-atari-2600-rom': 'Atari 2600',
    'application/x-atari2600-rom': 'Atari 2600',
    'application/x-playstation-rom': 'Sony PlayStation',
    'application/x-psx-rom': 'Sony PlayStation',
    'application/x-ngp-rom': 'Neo Geo Pocket',
    'application/x-neo-geo-pocket-rom': 'Neo Geo Pocket',
    'application/x-lynx-rom': 'Atari Lynx',
    'application/x-atari-lynx-rom': 'Atari Lynx',
    'application/x-virtualboy-rom': 'Nintendo Virtual Boy',
    'application/x-nintendo-virtualboy-rom': 'Nintendo Virtual Boy',
    'application/x-wonderswan-rom': 'WonderSwan',
    'application/x-pce-rom': 'PC Engine',
    'application/x-turbografx-rom': 'TurboGrafx-16',
    'application/x-nintendo-ds-rom': 'Nintendo DS',
    'application/x-nds-rom': 'Nintendo DS',
    'application/x-mame-rom': 'Arcade (MAME)',
    'application/x-arcade-rom': 'Arcade (MAME)',
    'application/x-dos-executable': 'MS-DOS',
    'application/x-msdos-program': 'MS-DOS',
  };

  return systemNames[mimeType] || 'Unknown System';
}

/**
 * Check if a MIME type is supported by EmulatorJS
 * @param mimeType - The MIME type to check
 * @returns true if the MIME type is supported
 */
export function isSupportedMimeType(mimeType: string): boolean {
  const supportedTypes = [
    'application/x-nes-rom',
    'application/x-nintendo-nes-rom',
    'application/x-snes-rom',
    'application/x-nintendo-snes-rom',
    'application/x-gameboy-rom',
    'application/x-gameboy-color-rom',
    'application/x-nintendo-gameboy-rom',
    'application/x-gba-rom',
    'application/x-gameboy-advance-rom',
    'application/x-nintendo-gba-rom',
    'application/x-n64-rom',
    'application/x-nintendo-64-rom',
    'application/x-genesis-rom',
    'application/x-megadrive-rom',
    'application/x-sega-genesis-rom',
    'application/x-sms-rom',
    'application/x-master-system-rom',
    'application/x-gamegear-rom',
    'application/x-sega-gamegear-rom',
    'application/x-atari-2600-rom',
    'application/x-atari2600-rom',
    'application/x-playstation-rom',
    'application/x-psx-rom',
    'application/x-ngp-rom',
    'application/x-neo-geo-pocket-rom',
    'application/x-lynx-rom',
    'application/x-atari-lynx-rom',
    'application/x-virtualboy-rom',
    'application/x-nintendo-virtualboy-rom',
    'application/x-wonderswan-rom',
    'application/x-pce-rom',
    'application/x-turbografx-rom',
    'application/x-nintendo-ds-rom',
    'application/x-nds-rom',
    'application/x-mame-rom',
    'application/x-arcade-rom',
    'application/x-dos-executable',
    'application/x-msdos-program',
  ];

  return supportedTypes.includes(mimeType);
}

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

/**
 * Get the maximum number of players for a game
 * @param event - The Nostr event (kind 31996) to check
 * @returns number of max players (defaults to 1 for single-player)
 */
export function getMaxPlayers(event: NostrEvent): number {
  const playersTag = event.tags.find(tag =>
    tag.length >= 2 &&
    tag[0] === 'players'
  );

  if (playersTag && playersTag[1]) {
    const players = parseInt(playersTag[1]);
    return isNaN(players) ? 1 : players;
  }

  // Default based on whether it's multiplayer or not
  return isMultiplayerGame(event) ? 2 : 1;
}