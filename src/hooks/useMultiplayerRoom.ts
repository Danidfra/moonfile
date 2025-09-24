import { useState, useEffect } from 'react';

interface ConnectedPlayer {
  pubkey: string;
  signal?: string;
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: number;
  senderName?: string;
}

interface RoomState {
  status: 'waiting' | 'active' | 'full' | 'error' | 'playing' | 'waiting_for_player' | 'waiting_to_retry';
  hostPubkey: string;
  requiredPlayers: number;
  connectedPlayers: ConnectedPlayer[];
  error?: string;
  shareableLink?: string;
  chatMessages?: ChatMessage[];
  canJoinGame?: boolean;
  isWebRTCConnected?: boolean;
}

export function useMultiplayerRoom(roomId: string, gameId: string) {
  // Static placeholder state - no connection logic
  const [roomState] = useState<RoomState>({
    status: 'waiting',
    hostPubkey: '',
    requiredPlayers: 2,
    connectedPlayers: [],
    chatMessages: [],
    canJoinGame: false,
    isWebRTCConnected: false,
  });

  // Placeholder logging for hook initialization
  useEffect(() => {
    console.log('[MultiplayerRoom] Hook initialized for room:', roomId, 'game:', gameId);
  }, [roomId, gameId]);

  // Dummy methods to keep UI functional
  const startGame = () => {
    console.log('[MultiplayerRoom] startGame called (placeholder)');
  };

  const sendGameInput = () => {
    console.log('[MultiplayerRoom] sendGameInput called (placeholder)');
  };

  const sendGameState = () => {
    console.log('[MultiplayerRoom] sendGameState called (placeholder)');
  };

  const sendChatMessage = (_message: string) => {
    console.log('[MultiplayerRoom] sendChatMessage called (placeholder)');
  };

  const setEmulatorStartCallback = (_callback: () => void) => {
    console.log('[MultiplayerRoom] setEmulatorStartCallback called (placeholder)');
  };

  const joinGame = () => {
    console.log('[MultiplayerRoom] joinGame called (placeholder)');
  };

  const retryConnection = () => {
    console.log('[MultiplayerRoom] retryConnection called (placeholder)');
  };

  return {
    roomState,
    startGame,
    isHost: false,
    webRTCConnection: null,
    localSignal: null,
    sendGameInput,
    sendGameState,
    sendChatMessage,
    setEmulatorStartCallback,
    joinGame,
    isJoining: false,
    connectionState: 'new' as RTCPeerConnectionState,
    iceConnectionState: 'new' as RTCIceConnectionState,
    isWebRTCConnected: false,
    hasConnectionTimedOut: false,
    retryConnection
  };
}