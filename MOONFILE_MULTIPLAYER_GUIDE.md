# MoonFile Multiplayer Room Implementation Guide

## Overview

This document describes the complete multiplayer room implementation for MoonFile using Nostr events for signaling and WebRTC for peer-to-peer connections. The implementation follows exact specifications for creating, joining, and managing multiplayer game sessions.

## 🎯 Requirements Implemented

✅ **Room Creation Flow**: Emulator page loads but doesn't start immediately  
✅ **Waiting Screen**: Shows "Waiting for other players..." message  
✅ **Nostr Event Structure**: Exact kind 31997 with specified tags  
✅ **WebRTC Signaling**: Offer/answer exchange via Nostr events  
✅ **State Management**: Latest created_at tracking for live room state  
✅ **Shareable Links**: Copy/share functionality for room invitations  
✅ **Host-Only Emulator**: Game runs only on host, streams to peers  

## 🏗️ Architecture

### Core Components

#### 1. **useMultiplayerRoom Hook** (`src/hooks/useMultiplayerRoom.ts`)
- **Purpose**: Manages room state and WebRTC connections
- **Key Features**:
  - Automatic room creation/joining logic
  - WebRTC offer/answer generation
  - Real-time state updates via Nostr polling
  - Host vs non-host role management
  - Shareable link generation

#### 2. **MultiplayerWaitingScreen Component** (`src/components/MultiplayerWaitingScreen.tsx`)
- **Purpose**: Displays connection status and player information
- **Key Features**:
  - Dynamic status messages (waiting → active → full → playing)
  - Connected players list with host identification
  - Invite link section with copy/share functionality
  - Start game button (host only when room is full)
  - Responsive design with proper loading states

#### 3. **MultiplayerRoomPage** (`src/pages/MultiplayerRoomPage.tsx`)
- **Purpose**: Orchestrates complete multiplayer experience
- **Key Features**:
  - Integrates waiting screen with existing layout
  - Shows emulator ONLY when `status === 'playing'`
  - Maintains game info, chat panel, and navigation
  - Proper error handling and loading states

## 📡 Protocol Specification

### Event Structure (Kind 31997)

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
  ]
}
```

### Required Tags

| Tag | Description | Example |
|-----|-------------|---------|
| `d` | Unique room identifier | `"room_q9k3ccg0p_ms"` |
| `game` | Game identifier | `"game:tetris-2-usa-nintendo:v1.0"` |
| `players` | Expected player count | `"2"` |
| `host` | Host's public key | `"npub1..."` |
| `status` | Current room status | `"waiting"` |

### Optional Tags

| Tag | Description | Example |
|-----|-------------|---------|
| `signal` | WebRTC offer (host) or answer (player) | `"{"type":"offer",...}"` |
| `connected` | Joining player's public key | `"npub1..."` |
| `player` | Player pubkey with their signal | `["player", "npub1...", "answer-json"]` |
| `connected_count` | Current number of connected players | `"1"` |

### Status Values

| Status | Description |
|--------|-------------|
| `waiting` | Waiting for players to join |
| `active` | Players are connecting via WebRTC |
| `full` | All expected players connected, ready to start |
| `playing` | Game session is active |
| `error` | Error state |

## 🔄 Flow Implementation

### 1. Room Creation (Host)

```
User navigates to /multiplayer/:gameId/:roomId
    ↓
Load game metadata to determine player count
    ↓
Create WebRTC offer with STUN servers
    ↓
Publish kind 31997 event:
  - d: room_id
  - game: game_id  
  - players: <from game metadata>
  - host: <host_pubkey>
  - status: "waiting"
  - signal: <SDP offer JSON>
    ↓
Generate shareable link: https://moonfile.games/multiplayer/:gameId/:roomId
    ↓
Show waiting screen with "Copy Invite Link" button
```

### 2. Player Discovery & Joining

```
Player opens multiplayer room link
    ↓
Fetch latest kind:31997 event via "d" tag
    ↓
Parse room state from most recent created_at
    ↓
If room exists and not full:
  - Extract WebRTC offer from "signal" tag
  - Create WebRTC answer
  - Publish new kind 31997 event:
    - Same "d" (room ID)
    - "connected": <joining_pubkey>
    - "player": <pubkey, answer_json>
    - "connected_count": current count
    - "signal": <SDP answer JSON>
    - "status": "active"
```

### 3. Connection Establishment

```
Host receives player's answer event
    ↓
Parse "signal" tag with WebRTC answer
    ↓
Complete WebRTC connection establishment
    ↓
Update room event with new "connected_count"
    ↓
When connected_count >= players count:
  - Update status to "full"
  - Host sees "Start Game" button
```

### 4. Game Session Start

```
Host clicks "Start Game" (only when status = "full")
    ↓
Publish event with status = "playing"
    ↓
Host's emulator starts automatically
    ↓
Host streams game canvas via WebRTC DataChannel
    ↓
Peers receive game state and send inputs via WebRTC
```

## 🎮 Game Flow Details

### Host Responsibilities
- **Emulator Execution**: Runs the actual NES emulator
- **Game Streaming**: Sends game state/video to all connected peers
- **Input Handling**: Receives input events from peers and injects into emulator
- **State Management**: Publishes room state updates via Nostr

### Peer Responsibilities  
- **Input Sending**: Sends controller inputs (arrow keys, A/B buttons) to host
- **State Receiving**: Receives and displays game state from host
- **Connection Management**: Maintains WebRTC connection stability
- **Event Monitoring**: Watches for room state changes via Nostr

## 🔗 Shareable Links

### Link Format
```
https://moonfile.games/multiplayer/:gameId/:roomId
```

### Example
```
https://moonfile.games/multiplayer/game:tetris-2-usa-nintendo:v1.0/room_q9k3ccg0p_ms
```

### Link Features
- **Auto-join**: Players can simply click link to join room
- **Copy Functionality**: One-click copy to clipboard
- **Share Integration**: Native share API on supported devices
- **Direct Access**: No additional authentication required

## 📱 User Interface

### Waiting Screen States

#### 1. Waiting State
- **Message**: "Waiting for other players to join..."
- **UI**: Shows host info + empty player slots
- **Actions**: Copy/share invite link (host only)

#### 2. Active State  
- **Message**: "Connecting players..."
- **UI**: Shows connection progress
- **Actions**: None (automatic process)

#### 3. Full State
- **Message**: "All players connected!"
- **UI**: Shows all connected players
- **Actions**: "Start Game" button (host only)

#### 4. Playing State
- **Message**: None (transition to emulator)
- **UI**: Full emulator interface
- **Actions**: Game controls and multiplayer features

### Player Display

```
┌─────────────────────────────────────────┐
│ 🎮 [Avatar] GameMaster 👑           │
│    Host • npub1abc...               │
│    [🟢] Connected                  │
├─────────────────────────────────────────┤
│ 🎮 [Avatar] SpeedRunner           │
│    Player • npub2def...            │  
│    [🟢] Connected                  │
├─────────────────────────────────────────┤
│ 🎮 [?] Waiting for player...       │
│    [⚫] Disconnected               │
└─────────────────────────────────────────┘
```

## 🛠️ Technical Implementation

### WebRTC Configuration

```typescript
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
});

// Data channel for game state/input
const dataChannel = pc.createDataChannel('game-data');
```

### Nostr Event Polling

```typescript
// Poll every 3 seconds for latest room state
const interval = setInterval(async () => {
  const events = await nostr.query([{
    kinds: [31997],
    '#d': [roomId],
    limit: 10
  }]);
  
  // Sort by created_at to get most recent
  const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
  updateRoomState(latestEvent);
}, 3000);
```

### State Management

```typescript
interface RoomState {
  status: 'waiting' | 'active' | 'full' | 'playing' | 'error';
  hostPubkey: string;
  requiredPlayers: number;
  connectedPlayers: ConnectedPlayer[];
  latestEvent: NostrEvent | null;
  shareableLink?: string;
}
```

## 🧪 Testing

### Test Coverage
- ✅ Hook initialization and state management
- ✅ Component rendering for all states
- ✅ Host vs non-host behavior
- ✅ Error state handling
- ✅ Invite link functionality
- ✅ WebRTC signal exchange
- ✅ Route structure validation

### Running Tests
```bash
npm test
```

## 🔒 Security Considerations

1. **Room ID Generation**: Cryptographically secure random values
2. **WebRTC Security**: STUN servers for NAT traversal
3. **Event Validation**: Signature verification and tag parsing
4. **Rate Limiting**: Client-side protection for event publishing
5. **Authentication**: Nostr pubkey-based identity system

## ⚡ Performance Optimizations

1. **Efficient Polling**: 3-second intervals for state updates
2. **State Management**: Minimal React re-renders
3. **WebRTC Optimization**: Proper ICE candidate handling
4. **Resource Cleanup**: Automatic connection and subscription cleanup
5. **Event Filtering**: Limit queries to most recent events

## 🚀 Deployment

### Requirements
- Nostr relay with write access
- Modern browser with WebRTC support
- STUN/TURN servers (production recommended)

### Configuration
```typescript
// STUN/TURN servers can be configured in useMultiplayerRoom
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // Add TURN servers for production reliability
  ]
});
```

## 🔮 Future Enhancements

1. **Spectator Mode**: Allow users to watch without playing
2. **Game Recording**: Record and share gameplay sessions  
3. **Voice Chat**: Integrated WebRTC audio communication
4. **Tournament Support**: Multi-room tournament management
5. **Enhanced Streaming**: Optimized video streaming for low latency
6. **Mobile Support**: Touch controls for mobile players

## 🐛 Troubleshooting

### Common Issues

#### Players Not Connecting
- Check WebRTC STUN server configuration
- Verify Nostr relay connectivity
- Ensure room ID is correctly shared
- Check browser WebRTC support

#### Game Not Starting
- Verify all players show as connected
- Ensure current user is host (only host can start)
- Check if room status is "full"
- Verify WebRTC data channel is established

#### High Latency
- Optimize WebRTC configuration
- Consider geographic relay selection
- Implement quality of service settings
- Check network connectivity

### Debug Mode
```javascript
localStorage.setItem('debug', 'multiplayer:*');
```

## 📝 Conclusion

This implementation provides a complete, production-ready multiplayer gaming system for MoonFile that:

- ✅ Eliminates need for central game servers
- ✅ Provides privacy through P2P connections  
- ✅ Scales to support 2+ players as specified
- ✅ Integrates with Nostr's social features
- ✅ Maintains security through pubkey authentication
- ✅ Offers easy sharing via copyable links
- ✅ Provides excellent user experience with proper loading states

The system is ready for production deployment and can be easily extended to support additional features and game types.