import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import NesPlayer from '@/components/NesPlayer';

// Mock React
import React from 'react';

// Mock Emulator component
vi.mock('@/emulator/Emulator', () => {
  const MockEmulator = React.forwardRef((props: any, ref: any) => {
    // Mock getCanvasStream method
    React.useImperativeHandle(ref, () => ({
      getCanvasStream: () => {
        const mockVideoTrack = {
          id: 'mock-video-track',
          kind: 'video',
          enabled: true,
          muted: false,
          readyState: 2,
          onended: null,
          onmute: null,
          onunmute: null,
          getSettings: () => ({}),
          applyConstraints: () => Promise.resolve(),
          clone: () => ({} as MediaStreamTrack),
          stop: () => {},
          contentHint: '',
          label: '',
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false
        } as unknown as MediaStreamTrack;

        const mockStream = {
          id: 'mock-stream-id',
          active: true,
          getVideoTracks: () => [mockVideoTrack],
          getAudioTracks: () => [],
          getTracks: () => [mockVideoTrack],
          addTrack: () => {},
          removeTrack: () => {},
          clone: () => mockStream as MediaStream,
          getTrackById: () => null,
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false
        } as unknown as MediaStream;

        return mockStream;
      }
    }));

    return React.createElement('div', { 'data-testid': 'mock-emulator' });
  });

  return { default: MockEmulator };
});

describe('NesPlayer Canvas Streaming', () => {
  const mockRomData = 'NES\x1a' + 'x'.repeat(10000); // Mock NES ROM data
  const mockPeerConnectionRef = {
    current: {
      addTrack: vi.fn().mockReturnValue({ track: { id: 'mock-track' } }),
      getSenders: vi.fn().mockReturnValue([]),
      removeTrack: vi.fn(),
      connectionState: 'connected',
      iceConnectionState: 'connected'
    } as any
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not setup streaming when not host', () => {
    const { container } = render(
      <TestApp>
        <NesPlayer
          romPath={mockRomData}
          title="Test Game"
          isHost={false}
          peerConnectionRef={mockPeerConnectionRef}
        />
      </TestApp>
    );

    expect(mockPeerConnectionRef.current.addTrack).not.toHaveBeenCalled();
  });

  it('should setup streaming when isHost and peerConnection is available', () => {
    render(
      <TestApp>
        <NesPlayer
          romPath={mockRomData}
          title="Test Game"
          isHost={true}
          peerConnectionRef={mockPeerConnectionRef}
        />
      </TestApp>
    );

    expect(mockPeerConnectionRef.current.addTrack).toHaveBeenCalled();
  });

  it('should not setup streaming when peerConnectionRef is null', () => {
    const { container } = render(
      <TestApp>
        <NesPlayer
          romPath={mockRomData}
          title="Test Game"
          isHost={true}
        />
      </TestApp>
    );

    expect(mockPeerConnectionRef.current.addTrack).not.toHaveBeenCalled();
  });

  it('should expose getCanvasStream method via ref', () => {
    const ref = React.createRef<any>();
    
    render(
      <TestApp>
        <NesPlayer
          ref={ref}
          romPath={mockRomData}
          title="Test Game"
          isHost={true}
          peerConnectionRef={mockPeerConnectionRef}
        />
      </TestApp>
    );

    expect(ref.current).toBeTruthy();
    expect(typeof ref.current.getCanvasStream).toBe('function');
    
    const stream = ref.current.getCanvasStream();
    expect(stream).toBeTruthy();
    expect(stream.id).toBe('mock-stream-id');
  });

  it('should cleanup streaming on unmount', () => {
    const { unmount } = render(
      <TestApp>
        <NesPlayer
          romPath={mockRomData}
          title="Test Game"
          isHost={true}
          peerConnectionRef={mockPeerConnectionRef}
        />
      </TestApp>
    );

    expect(mockPeerConnectionRef.current.addTrack).toHaveBeenCalledTimes(1);
    
    unmount();
    
    // Verify getSenders was called during cleanup
    expect(mockPeerConnectionRef.current.getSenders).toHaveBeenCalled();
  });
});