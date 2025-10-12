export const ONE_MB = 1_000_000;

export const ROM_MIME_BY_EXT: Record<string, string> = {
  ".nes": "application/x-nes-rom",
  ".sfc": "application/x-snes-rom",
  ".smc": "application/x-snes-rom",
  ".gba": "application/x-gba-rom",
  ".gb":  "application/x-gb-rom",
  ".gbc": "application/x-gbc-rom",
  ".n64": "application/x-n64-rom",
  ".z64": "application/x-n64-rom",
  ".v64": "application/x-n64-rom",
  ".nds": "application/x-nds-rom",
  ".bin": "application/x-genesis-rom",
  ".sms": "application/x-sms-rom",
  ".gg":  "application/x-gg-rom",
  ".pce": "application/x-pce-rom",
  ".a26": "application/x-atari2600-rom",
  ".a78": "application/x-atari7800-rom",
  // Add more as needed
};

export const PLATFORM_FROM_MIME: Record<string, string> = {
  "application/x-nes-rom": "nes-rom",
  "application/x-snes-rom": "snes-rom",
  "application/x-gba-rom": "gba-rom",
  "application/x-gb-rom": "gb-rom",
  "application/x-gbc-rom": "gbc-rom",
  "application/x-n64-rom": "n64-rom",
  "application/x-nds-rom": "nds-rom",
  "application/x-genesis-rom": "genesis-rom",
  "application/x-sms-rom": "sms-rom",
  "application/x-gg-rom": "gg-rom",
  "application/x-pce-rom": "pce-rom",
  "application/x-atari2600-rom": "atari2600-rom",
  "application/x-atari7800-rom": "atari7800-rom",
};