import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import MultiplayerWaitingScreen from './MultiplayerWaitingScreen';

describe('MultiplayerWaitingScreen', () => {
  const mockPlayers = [
    {
      pubkey: 'host-pubkey',
      connected: true,
      isHost: true
    },
    {
      pubkey: 'player-pubkey',
      connected: true,
      isHost: false
    }
  ];

  it('renders waiting state correctly', () => {
    render(
      <TestApp>
        <MultiplayerWaitingScreen
          status="waiting"
          players={mockPlayers}
          requiredPlayers={2}
          isHost={true}
        />
      </TestApp>
    );

    expect(screen.getByText('Waiting for other players to join...')).toBeInTheDocument();
    expect(screen.getByText('Players (2/2)')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('renders connecting state correctly', () => {
    render(
      <TestApp>
        <MultiplayerWaitingScreen
          status="connecting"
          players={mockPlayers}
          requiredPlayers={2}
          isHost={false}
        />
      </TestApp>
    );

    expect(screen.getByText('Connecting players...')).toBeInTheDocument();
  });

  it('renders ready state correctly', () => {
    render(
      <TestApp>
        <MultiplayerWaitingScreen
          status="ready"
          players={mockPlayers}
          requiredPlayers={2}
          isHost={false}
        />
      </TestApp>
    );

    expect(screen.getByText('All players connected!')).toBeInTheDocument();
    expect(screen.getByText('Waiting for host to start the game...')).toBeInTheDocument();
  });

  it('shows start button for host when ready', () => {
    const mockStartGame = vi.fn();

    render(
      <TestApp>
        <MultiplayerWaitingScreen
          status="ready"
          players={mockPlayers}
          requiredPlayers={2}
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
          players={[mockPlayers[0]]} // Only host
          requiredPlayers={2}
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
          players={mockPlayers}
          requiredPlayers={2}
          isHost={true}
          error="Connection failed"
        />
      </TestApp>
    );

    expect(screen.getByText('Connection Error')).toBeInTheDocument();
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });
});