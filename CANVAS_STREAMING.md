# Canvas Streaming Implementation

## Overview

This implementation adds live canvas streaming support to the NesPlayer component when `isHost` is true. The canvas from the Emulator component is captured using `captureStream()` and added to the WebRTC connection for streaming to guests.

## Implementation Details

### 1. Emulator Component (`src/emulator/Emulator.tsx`)

**Changes Made:**
- Added `canvasRef` to track the HTML canvas element
- Implemented `getCanvasStream()` method that returns `canvasRef.current?.captureStream(30)` (30 FPS)
- Passed `canvasRef` prop to the Screen component

**Key Method:**
```typescript
getCanvasStream = (): MediaStream | null => {
  console.log('[Emulator] 📹 getCanvasStream called at:', new Date().toISOString());
  
  if (this.canvasRef.current) {
    try {
      console.log('[Emulator] 📹 Canvas found, capturing stream at 30 FPS');
      const stream = this.canvasRef.current.captureStream(30);
      console.log('[Emulator] ✅ Canvas stream captured successfully:', {
        id: stream.id,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      });
      return stream;
    } catch (error) {
      console.error('[Emulator] ❌ Failed to capture canvas stream:', error);
      return null;
    }
  } else {
    console.warn('[Emulator] ❌ Canvas ref not available for stream capture');
    return null;
  }
};
```

### 2. Screen Component (`src/emulator/video/Screen.tsx`)

**Changes Made:**
- Added `canvasRef` prop to accept external canvas reference
- Modified render method to forward canvas reference to external ref
- Fixed TypeScript compatibility for ref assignment

**Key Change:**
```typescript
ref={(canvas) => {
  this.canvas = canvas;
  if (this.props.canvasRef) {
    (this.props.canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = canvas;
  }
}}
```

### 3. NesPlayer Component (`src/components/NesPlayer.tsx`)

**Changes Made:**
- Converted to forwardRef component to expose methods
- Added `isHost` and `peerConnectionRef` props
- Implemented canvas streaming useEffect that triggers when `isHost === true`
- Added comprehensive logging for debugging
- Implemented cleanup for WebRTC tracks on unmount

**Key Features:**
- **Conditional Streaming**: Only activates when `isHost` is true and both emulator and peer connection are available
- **Automatic Re-triggering**: Effect re-runs when `romPath` changes (emulator re-mounts)
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Cleanup**: Proper removal of video tracks when component unmounts

**Streaming Effect:**
```typescript
useEffect(() => {
  if (isHost && emulatorRef.current && peerConnectionRef?.current) {
    const setupCanvasStreaming = async () => {
      try {
        // Get canvas stream from emulator
        const canvasStream = emulatorRef.current.getCanvasStream();
        
        if (!canvasStream) {
          console.error('[NesPlayer] ❌ Failed to get canvas stream from emulator');
          return;
        }

        // Get video track and add to peer connection
        const videoTracks = canvasStream.getVideoTracks();
        if (videoTracks.length > 0) {
          const videoTrack = videoTracks[0];
          const sender = peerConnectionRef.current.addTrack(videoTrack, canvasStream);
          
          // Set up track event handlers
          videoTrack.onended = () => console.log('[NesPlayer] 📹 Video track ended');
          videoTrack.onmute = () => console.log('[NesPlayer] 📹 Video track muted');
          videoTrack.onunmute = () => console.log('[NesPlayer] 📹 Video track unmuted');
        }
      } catch (error) {
        console.error('[NesPlayer] ❌ Error setting up canvas streaming:', error);
        setError(error instanceof Error ? error.message : 'Failed to setup canvas streaming');
      }
    };

    setupCanvasStreaming();

    // Cleanup on unmount
    return () => {
      // Remove video tracks from peer connection
      if (peerConnectionRef?.current) {
        const senders = peerConnectionRef.current.getSenders();
        const videoSenders = senders.filter(sender => 
          sender.track && sender.track.kind === 'video'
        );
        videoSenders.forEach(sender => {
          peerConnectionRef.current?.removeTrack(sender);
        });
      }
    };
  }
}, [isHost, romPath]);
```

### 4. Multiplayer Integration (`src/pages/MultiplayerRoomPage.tsx`)

**Changes Made:**
- Updated to pass `isHost` and `peerConnectionRef` to NesPlayer component
- Integrated with existing multiplayer hook and WebRTC connection

**Usage:**
```typescript
<NesPlayer
  romPath={romPath}
  title={gameMeta.title}
  className="w-full"
  isHost={isHost}
  peerConnectionRef={peerConnectionRef}
/>
```

### 5. Hook Integration (`src/hooks/useMultiplayerRoom.ts`)

**Changes Made:**
- Exposed `hostPeerConnectionRef` as `peerConnectionRef` in hook return value
- Allows MultiplayerRoomPage to access the WebRTC connection

## Usage

### Basic Usage

```typescript
import NesPlayer, { NesPlayerRef } from '@/components/NesPlayer';

const MyComponent = () => {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const nesPlayerRef = useRef<NesPlayerRef>(null);

  // Create WebRTC connection
  useEffect(() => {
    peerConnectionRef.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
  }, []);

  return (
    <NesPlayer
      ref={nesPlayerRef}
      romPath={romData}
      title="My Game"
      isHost={true}
      peerConnectionRef={peerConnectionRef}
    />
  );
};
```

### Accessing Canvas Stream

```typescript
// Get canvas stream programmatically
const stream = nesPlayerRef.current?.getCanvasStream();
if (stream) {
  const videoTrack = stream.getVideoTracks()[0];
  console.log('Video track:', videoTrack.id);
}
```

## Debugging

The implementation includes comprehensive logging for debugging:

1. **Emulator Logs:**
   - `[Emulator] 📹 getCanvasStream called` - When stream capture is requested
   - `[Emulator] ✅ Canvas stream captured successfully` - Successful stream capture
   - `[Emulator] ❌ Failed to capture canvas stream` - Capture failures

2. **NesPlayer Logs:**
   - `[NesPlayer] 🎥 Canvas streaming effect triggered` - When streaming effect runs
   - `[NesPlayer] 📹 Getting canvas stream from emulator` - Stream retrieval attempt
   - `[NesPlayer] 🔗 Adding video track to WebRTC peer connection` - Track addition
   - `[NesPlayer] ✅ Video track added to peer connection` - Successful addition
   - `[NesPlayer] 🧹 Cleaning up canvas streaming` - Cleanup on unmount

## Error Handling

The implementation includes several fallback mechanisms:

1. **Stream Capture Failure**: If `captureStream()` fails, logs error but doesn't crash
2. **No Video Tracks**: If canvas stream has no video tracks, logs warning and exits gracefully
3. **Peer Connection Issues**: If peer connection is not available, skips streaming setup
4. **Ref Availability**: Checks for emulator and canvas ref availability before operations

## Browser Compatibility

- **Chrome**: Full support for `canvas.captureStream()`
- **Firefox**: Full support for `canvas.captureStream()`
- **Safari**: Limited support, may require fallback
- **Edge**: Full support for `canvas.captureStream()`

## Performance Considerations

- **30 FPS**: Stream captures at 30 FPS for good balance of quality and performance
- **Automatic Cleanup**: Video tracks are properly removed when component unmounts
- **Conditional Setup**: Streaming only activates when needed (host mode with connection)
- **Efficient Re-triggering**: Effect re-runs only when necessary dependencies change

## Testing

A comprehensive test suite is included in `src/test/canvas-streaming.test.tsx` that covers:

1. **Conditional Streaming**: Verifies streaming only activates when `isHost` is true
2. **Peer Connection Dependency**: Ensures streaming requires valid peer connection
3. **Method Exposure**: Validates `getCanvasStream` method is available via ref
4. **Cleanup Verification**: Confirms proper cleanup on component unmount

Run tests with:
```bash
npm test
```

## Future Enhancements

Potential improvements for future iterations:

1. **Audio Streaming**: Add audio track capture from emulator
2. **Quality Settings**: Configurable stream quality and FPS
3. **Fallback Mechanisms**: Alternative streaming methods for unsupported browsers
4. **Bandwidth Adaptation**: Dynamic quality adjustment based on network conditions
5. **Multiple Tracks**: Support for multiple video tracks or screen sharing