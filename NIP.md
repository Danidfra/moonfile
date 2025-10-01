# Multiplayer Gaming Sessions

**NIP Name:** Multiplayer Gaming Sessions
**NIP Number:** Custom Extension
**Status:** Draft
**Author:** Moonfile Team
**Created:** 2025-09-23

## Summary

This NIP defines a protocol for creating and managing multiplayer gaming sessions using WebRTC for peer-to-peer connections and Nostr events for signaling and coordination. It enables players to join game rooms, establish peer connections, and synchronize game state without requiring central servers.

## Motivation

Multiplayer gaming typically requires dedicated servers for matchmaking, game state synchronization, and peer coordination. This NIP leverages Nostr's decentralized event system and WebRTC's peer-to-peer capabilities to create a decentralized multiplayer gaming infrastructure that:

1. Eliminates the need for central game servers
2. Provides privacy through direct peer connections
3. Enables persistent room state through Nostr events
4. Supports scalable multiplayer sessions
5. Integrates with Nostr's identity and social features

## Event Kind: 31996 - Game Definition

This event kind defines NES/SNES games with metadata and ROM data.

### Event Structure

```json
{
  "kind": 31996,
  "content": "<base64-encoded-rom-data>",
  "tags": [
    ["d", "game:super-mario-bros:v1.0"],
    ["name", "Super Mario Bros."],
    ["summary", "Classic platformer game"],
    ["platform", "NES"],
    ["mode", "singleplayer"],
    ["mode", "multiplayer"],
    ["players", "2"],
    ["t", "platformer"],
    ["t", "action"],
    ["encoding", "base64"],
    ["alt", "NES game: Super Mario Bros."]
  ],
  "pubkey": "<publisher-pubkey>",
  "created_at": <timestamp>
}
```

### Required Tags

| Tag | Description | Example |
|-----|-------------|---------|
| `d` | Unique game identifier | `"game:super-mario-bros:v1.0"` |
| `name` | Game title | `"Super Mario Bros."` |
| `platform` | Console platform | `"NES"` |
| `encoding` | ROM data encoding | `"base64"` |

### Optional Tags

| Tag | Description | Example |
|-----|-------------|---------|
| `summary` | Game description | `"Classic platformer game"` |
| `mode` | Game modes supported | `"multiplayer"` |
| `players` | Max players for multiplayer | `"2"` |
| `t` | Genre/category tags | `"platformer"` |
| `image` | Game assets | `["image", "cover", "https://..."]` |
| `alt` | Human-readable description | `"NES game: Super Mario Bros."` |

## Event Kind: 31997 - Multiplayer Room Session

This event kind is used to create, manage, and coordinate multiplayer gaming sessions.

### Event Structure

```json
{
  "kind": 31997,
  "content": "",
  "tags": [
    ["d", "game:super-mario-bros:room:session_abc123xyz"],
    ["host", "<host-pubkey-hex>"],
    ["players", "2"],
    ["status", "available"],
    ["signal", "<base64-webrtc-offer>"],
    ["guest", "<guest-pubkey-hex>"],
    ["connected", "<connected-pubkey-hex>"],
    ["alt", "Multiplayer session for Super Mario Bros."]
  ],
  "pubkey": "<event-publisher-pubkey>",
  "created_at": <timestamp>
}
```

### Required Tags

| Tag | Description | Example |
|-----|-------------|---------|
| `d` | Session identifier (game:gameId:room:sessionId) | `"game:super-mario-bros:room:session_abc123xyz"` |
| `host` | Host's public key (hex) | `"<host-pubkey-hex>"` |
| `players` | Expected number of players (string) | `"2"` |
| `status` | Current room status | `"available"` |

### Optional Tags

| Tag | Description | Example |
|-----|-------------|---------|
| `signal` | WebRTC offer/answer (base64) | `"<base64-webrtc-signal>"` |
| `guest` | Guest pubkey attempting to join | `"<guest-pubkey-hex>"` |
| `connected` | Successfully connected player pubkey | `"<connected-pubkey-hex>"` |
| `alt` | Human-readable description | `"Multiplayer session for Super Mario Bros."` |

### Status Values

| Status | Description |
|--------|-------------|
| `creating` | Session is being created |
| `available` | Waiting for players to join |
| `full` | All expected players connected |
| `error` | Error state |

## Flow

### 1. Game Definition (Publisher)

1. Publisher uploads NES/SNES ROM
2. Publisher creates metadata for the game
3. Publisher publishes kind 31996 event with game data:
   ```json
   {
     "kind": 31996,
     "content": "<base64-rom-data>",
     "tags": [
       ["d", "game:super-mario-bros:v1.0"],
       ["name", "Super Mario Bros."],
       ["platform", "NES"],
       ["mode", "multiplayer"],
       ["players", "2"],
       ["encoding", "base64"]
     ]
   }
   ```

### 2. Room Creation (Host)

1. Host loads a multiplayer game (kind 31996 with mode "multiplayer")
2. Host generates unique session ID
3. Host creates WebRTC offer from game canvas stream
4. Host publishes kind 31997 event:
   ```json
   {
     "kind": 31997,
     "content": "",
     "tags": [
       ["d", "game:super-mario-bros:room:session_abc123xyz"],
       ["host", "<host-pubkey-hex>"],
       ["players", "2"],
       ["status", "available"],
       ["signal", "<base64-webrtc-offer>"]
     ]
   }
   ```

### 3. Player Discovery

Players discover rooms by:
- Direct session URL: `/multiplayer/guest/game:super-mario-bros:room:session_abc123xyz`
- Querying events: `{"kinds": [31997], "#d": ["game:super-mario-bros:room:session_abc123xyz"]}`
- Game-specific queries: `{"kinds": [31997], "#d": ["game:super-mario-bros:*"]}`

### 4. Player Joining

1. Guest navigates to session URL
2. Guest fetches game metadata (kind 31996) by game ID
3. Guest fetches session data (kind 31997) by session ID
4. Guest creates WebRTC answer to host's offer
5. Guest publishes join event:
   ```json
   {
     "kind": 31997,
     "content": "",
     "tags": [
       ["d", "game:super-mario-bros:room:session_abc123xyz"],
       ["host", "<host-pubkey-hex>"],
       ["guest", "<guest-pubkey-hex>"],
       ["signal", "<base64-webrtc-answer>"]
     ]
   }
   ```

### 5. Connection Establishment

1. Host receives guest's answer via Nostr event subscription
2. Host creates new peer connection for the guest
3. Host sets guest's answer as remote description
4. Host updates session with connected guest:
   ```json
   {
     "kind": 31997,
     "content": "",
     "tags": [
       ["d", "game:super-mario-bros:room:session_abc123xyz"],
       ["host", "<host-pubkey-hex>"],
       ["guest", "<guest-pubkey-hex>"],
       ["connected", "<guest-pubkey-hex>"],
       ["status", "full"]
     ]
   }
   ```

### 6. Game Session

1. Host captures video stream from game canvas
2. Host streams game video via WebRTC to all connected guests
3. Guests receive and display the host's game stream
4. Host maintains separate peer connections for each guest
5. Host manages game state and controls

### 7. Session Management

1. Guests can leave by closing connection
2. Host can end session by closing all connections
3. Session status is updated when players connect/disconnect
4. Room becomes "full" when max players is reached

## WebRTC Signaling Format

WebRTC offers and answers are stored as JSON strings in the `signal` tag:

```json
{
  "type": "offer",
  "sdp": "v=0\r\no=- 1234567890...",
  "iceCandidates": [
    {
      "candidate": "candidate:1 1 UDP 2130706431...",
      "sdpMid": "0",
      "sdpMLineIndex": 0
    }
  ]
}
```

## Data Channel Usage

Once connected, peers use WebRTC data channels for:

- **Input Events**: Player button presses, controller state
- **Game State**: Score, level, player positions (host → players)
- **Synchronization**: Timestamps, state validation
- **Chat**: In-game messaging

### Message Format

```json
{
  "type": "input",
  "timestamp": 1234567890,
  "player": 1,
  "data": {
    "buttons": ["A", "RIGHT"],
    "timestamp": 1234567890
  }
}
```

## Querying Rooms

### Find Games by Platform

```json
{
  "kinds": [31996],
  "#platform": ["NES"],
  "limit": 50
}
```

### Find Multiplayer Games

```json
{
  "kinds": [31996],
  "#mode": ["multiplayer"],
  "limit": 20
}
```

### Find Active Rooms for a Game

```json
{
  "kinds": [31997],
  "#d": ["game:super-mario-bros:room:*"],
  "#status": ["available"],
  "limit": 10
}
```

### Find Rooms by Host

```json
{
  "kinds": [31997],
  "#host": ["<host-pubkey-hex>"],
  "limit": 20
}
```

### Monitor Specific Session

```json
{
  "kinds": [31997],
  "#d": ["game:super-mario-bros:room:session_abc123xyz"],
  "limit": 50
}
```

## Security Considerations

1. **WebRTC Security**: Use TURN servers for NAT traversal, implement ICE candidate filtering
2. **Event Validation**: Verify signatures and tag formats
3. **Room Ownership**: Only host can update certain room properties
4. **Rate Limiting**: Implement client-side rate limiting for event publishing
5. **Privacy**: Consider using NIP-04/NIP-44 for encrypted room events

## Implementation Notes

1. **Room IDs**: Should be unique and difficult to guess (use cryptographic random values)
2. **Timeout**: Implement client-side timeout for inactive rooms
3. **Reconnection**: Support reconnection logic for dropped players
4. **Fallback**: Provide fallback to relay-based communication if WebRTC fails
5. **Scalability**: For games with many players, consider host-client architecture

## Backwards Compatibility

This NIP is fully backwards compatible as it introduces a new event kind that existing clients can safely ignore. Rooms created with this NIP will not interfere with other Nostr functionality.

## References

- [WebRTC specification](https://www.w3.org/TR/webrtc/)
- [NIP-01: Basic protocol flow](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-19: bech32-encoded entities](https://github.com/nostr-protocol/nips/blob/master/19.md)
- [NIP-31: Dealing with Unknown Events](https://github.com/nostr-protocol/nips/blob/master/31.md)