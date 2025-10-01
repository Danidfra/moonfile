import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import MultiplayerCard from './MultiplayerCard';

// Mock the navigate function
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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

  it('shows invite link input after clicking Start Session', () => {
    render(
      <TestApp>
        <MultiplayerCard gameMeta={mockGameMeta} />
      </TestApp>
    );

    const startButton = screen.getByText('Start Session');
    fireEvent.click(startButton);

    expect(screen.getByLabelText('Invite Link')).toBeInTheDocument();
    expect(screen.getByText('Create Session')).toBeInTheDocument();
    expect(screen.getByLabelText('Copy invite link')).toBeInTheDocument();
  });

  it('shows session ID input after clicking Join Session', () => {
    render(
      <TestApp>
        <MultiplayerCard gameMeta={mockGameMeta} />
      </TestApp>
    );

    const joinButton = screen.getByText('Join Session');
    fireEvent.click(joinButton);

    expect(screen.getByLabelText('Enter Session ID')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. abc123xyz')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join/i })).toBeInTheDocument();
  });

  it('navigates to guest room when joining with session ID', () => {
    render(
      <TestApp>
        <MultiplayerCard gameMeta={mockGameMeta} />
      </TestApp>
    );

    // Click Join Session
    const joinButton = screen.getByText('Join Session');
    fireEvent.click(joinButton);

    // Enter session ID
    const sessionInput = screen.getByLabelText('Enter Session ID');
    fireEvent.change(sessionInput, { target: { value: 'test123' } });

    // Click Join
    const joinConfirmButton = screen.getByRole('button', { name: /join/i });
    fireEvent.click(joinConfirmButton);

    // Verify navigation was called with correct path
    expect(mockNavigate).toHaveBeenCalledWith('/multiplayer/guest/test123');
  });
});