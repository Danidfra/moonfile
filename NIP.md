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

## Event Kind: 31997 - Multiplayer Room Session

This event kind is used to create, manage, and coordinate multiplayer gaming sessions.

### Event Structure

```json
{
  "kind": 31997,
  "content": "",
  "tags": [
    ["d", "room_q9k3ccg0p_ms"],
    ["game", "game:tetris-2-usa-nintendo:v1.0"],
    ["players", "2"],
    ["host", "npub1..."],
    ["status", "waiting"],
    ["signal", "webrtc-offer-json"],
    ["connected", "joining-pubkey"],
    ["player", "joining-pubkey", "webrtc-answer-json"],
    ["connected_count", "1"]
  ],
  "pubkey": "<host-pubkey>",
  "created_at": <timestamp>
}
```

### Required Tags

| Tag | Description | Example |
|-----|-------------|---------|
| `d` | Unique room/session identifier | `"room_q9k3ccg0p_ms"` |
| `game` | Game identifier matching the game's `d` tag | `"game:tetris-2-usa-nintendo:v1.0"` |
| `players` | Expected number of players (string) | `"2"` |
| `host` | Host's public key (npub or hex) | `"npub1..."` |
| `status` | Current room status | `"waiting"` |

### Optional Tags

| Tag | Description | Example |
|-----|-------------|---------|
| `signal` | WebRTC offer/answer JSON (host only) | `"{"type":"offer",..."}` |
| `player` | Player pubkey and their signal (for non-host players) | `["player", "npub1...", "answer-json"]` |
| `alt` | Human-readable description | `"Multiplayer room for Tetris"` |

### Status Values

| Status | Description |
|--------|-------------|
| `waiting` | Waiting for players to join |
| `active` | Players are connecting via WebRTC |
| `full` | All expected players connected, ready to start |
| `playing` | Game session is active |
| `error` | Error state |

## Flow

### 1. Room Creation (Host)

1. Host generates unique room ID
2. Host creates WebRTC offer
3. Host publishes kind 31997 event:
   ```json
   {
     "kind": 31997,
     "content": "",
     "tags": [
       ["d", "room_q9k3ccg0p_ms"],
       ["game", "game:tetris-2-usa-nintendo:v1.0"],
       ["players", "2"],
       ["host", "<host-pubkey>"],
       ["status", "waiting"],
       ["signal", "<webrtc-offer-json>"]
     ]
   }
   ```

### 2. Player Discovery

Players discover rooms by:
- Direct room URL: `/multiplayer/game:tetris-2-usa-nintendo:v1.0/room_q9k3ccg0p_ms`
- Querying events: `{"kinds": [31997], "#d": ["room_q9k3ccg0p_ms"]}`
- Game-specific queries: `{"kinds": [31997], "#game": ["game:tetris-2-usa-nintendo:v1.0"]}`

### 3. Player Joining

1. Player navigates to room URL
2. Player subscribes to room events
3. Player receives host's WebRTC offer
4. Player creates WebRTC answer
5. Player publishes updated room event:
   ```json
   {
     "kind": 31997,
     "content": "",
     "tags": [
       ["d", "room_q9k3ccg0p_ms"],
       ["game", "game:tetris-2-usa-nintendo:v1.0"],
       ["players", "2"],
       ["host", "<host-pubkey>"],
       ["status", "connecting"],
       ["player", "<player-pubkey>", "<webrtc-answer-json>"]
     ]
   }
   ```

### 4. Connection Establishment

1. Host receives player's answer via Nostr event
2. Host completes WebRTC connection
3. Both peers establish data channels for game communication
4. Host updates room status to "ready" when all players connected

### 5. Game Session

1. Host starts emulator/game instance
2. Host streams game video/audio via WebRTC
3. Players send input events via WebRTC data channels
4. Host broadcasts game state updates to all players

### 6. Session End

1. Any player can leave by publishing event with `status: "finished"`
2. Room remains active for reconnecting within timeout period
3. After timeout, room becomes inactive

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

### Find Active Rooms for a Game

```json
{
  "kinds": [31997],
  "#game": ["game:tetris-2-usa-nintendo:v1.0"],
  "#status": ["waiting", "ready"],
  "limit": 10
}
```

### Find Rooms by Host

```json
{
  "kinds": [31997],
  "#host": ["<host-pubkey>"],
  "limit": 20
}
```

### Monitor Room Updates

```json
{
  "kinds": [31997],
  "#d": ["room_q9k3ccg0p_ms"],
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