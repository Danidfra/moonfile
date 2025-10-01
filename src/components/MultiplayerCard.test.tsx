import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import MultiplayerCard from './MultiplayerCard';

describe('MultiplayerCard', () => {
  const mockGameMeta = {
    id: 'test-game',
    title: 'Test Game',
    assets: {
      cover: 'https://example.com/cover.jpg'
    }
  };

  it('renders multiplayer card with game title', () => {
    render(
      <TestApp>
        <MultiplayerCard gameMeta={mockGameMeta} />
      </TestApp>
    );

    expect(screen.getByText('Multiplayer Session')).toBeInTheDocument();
    expect(screen.getByText('Test Game')).toBeInTheDocument();
    expect(screen.getByText('Multiplayer Enabled')).toBeInTheDocument();
  });

  it('shows start and join session buttons when idle', () => {
    render(
      <TestApp>
        <MultiplayerCard gameMeta={mockGameMeta} />
      </TestApp>
    );

    expect(screen.getByText('Start Session')).toBeInTheDocument();
    expect(screen.getByText('Join Session')).toBeInTheDocument();
  });

  it('displays not connected status initially', () => {
    render(
      <TestApp>
        <MultiplayerCard gameMeta={mockGameMeta} />
      </TestApp>
    );

    expect(screen.getByText('Not Connected')).toBeInTheDocument();
  });
});