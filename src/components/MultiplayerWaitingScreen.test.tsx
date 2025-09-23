import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import MultiplayerWaitingScreen from './MultiplayerWaitingScreen';

describe('MultiplayerWaitingScreen', () => {
  const mockConnectedPlayers = [
    {
      pubkey: 'host-pubkey',
      signal: 'offer-signal'
    },
    {
      pubkey: 'player-pubkey',
      signal: 'answer-signal'
    }
  ];

  it('renders waiting state correctly', () => {
    render(
      <TestApp>
        <MultiplayerWaitingScreen
          status="waiting"
          connectedPlayers={mockConnectedPlayers}
          requiredPlayers={2}
          hostPubkey="host-pubkey"
          isHost={true}
        />
      </TestApp>
    );

    expect(screen.getByText('Waiting for other players to join...')).toBeInTheDocument();
    expect(screen.getByText('Players (2/2)')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('renders active state correctly', () => {
    render(
      <TestApp>
        <MultiplayerWaitingScreen
          status="active"
          connectedPlayers={mockConnectedPlayers}
          requiredPlayers={2}
          hostPubkey="host-pubkey"
          isHost={false}
        />
      </TestApp>
    );

    expect(screen.getByText('Connecting players...')).toBeInTheDocument();
  });

  it('renders full state correctly', () => {
    render(
      <TestApp>
        <MultiplayerWaitingScreen
          status="full"
          connectedPlayers={mockConnectedPlayers}
          requiredPlayers={2}
          hostPubkey="host-pubkey"
          isHost={false}
        />
      </TestApp>
    );

    expect(screen.getByText('All players connected!')).toBeInTheDocument();
    expect(screen.getByText('Waiting for host to start the game...')).toBeInTheDocument();
  });

  it('shows invite link section for host', () => {
    render(
      <TestApp>
        <MultiplayerWaitingScreen
          status="waiting"
          connectedPlayers={[mockConnectedPlayers[0]]}
          requiredPlayers={2}
          hostPubkey="host-pubkey"
          isHost={true}
          shareableLink="https://moonfile.games/multiplayer/game:tetris-2-usa-nintendo:v1.0/room_q9k3ccg0p_ms"
        />
      </TestApp>
    );

    expect(screen.getByText('Invite Link')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://moonfile.games/multiplayer/game:tetris-2-usa-nintendo:v1.0/room_q9k3ccg0p_ms')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument();
  });

  it('shows start button for host when full', () => {
    const mockStartGame = vi.fn();

    render(
      <TestApp>
        <MultiplayerWaitingScreen
          status="full"
          connectedPlayers={mockConnectedPlayers}
          requiredPlayers={2}
          hostPubkey="host-pubkey"
          isHost={true}
          onStartGame={mockStartGame}
        />
      </TestApp>
    );

    const startButton = screen.getByRole('button', { name: /start game/i });
    expect(startButton).toBeInTheDocument();

    startButton.click();
    expect(mockStartGame).toHaveBeenCalled();
  });

  it('shows empty slots for missing players', () => {
    render(
      <TestApp>
        <MultiplayerWaitingScreen
          status="waiting"
          connectedPlayers={[mockConnectedPlayers[0]]} // Only host
          requiredPlayers={2}
          hostPubkey="host-pubkey"
          isHost={true}
        />
      </TestApp>
    );

    expect(screen.getByText('Players (1/2)')).toBeInTheDocument();
    expect(screen.getByText('Waiting for player...')).toBeInTheDocument();
  });

  it('shows error state correctly', () => {
    render(
      <TestApp>
        <MultiplayerWaitingScreen
          status="error"
          connectedPlayers={mockConnectedPlayers}
          requiredPlayers={2}
          hostPubkey="host-pubkey"
          isHost={true}
          error="Connection failed"
        />
      </TestApp>
    );

    expect(screen.getByText('Connection Error')).toBeInTheDocument();
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });
});