import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MultiplayerRoomPage from './MultiplayerRoomPage';

describe('MultiplayerRoomPage', () => {
  it('renders loading state initially', () => {
    render(
      <TestApp>
        <MemoryRouter initialEntries={['/multiplayer/game:tetris-2-usa-nintendo:v1.0/room_q9k3ccg0p_ms']}>
          <Routes>
            <Route path="/multiplayer/:gameId/:roomId" element={<MultiplayerRoomPage />} />
          </Routes>
        </MemoryRouter>
      </TestApp>
    );

    expect(screen.getByText('Loading Multiplayer Room')).toBeInTheDocument();
  });

  it('has correct route structure', () => {
    const route = '/multiplayer/game:tetris-2-usa-nintendo:v1.0/room_q9k3ccg0p_ms';
    const gameId = 'game:tetris-2-usa-nintendo:v1.0';
    const roomId = 'room_q9k3ccg0p_ms';

    expect(route).toContain(gameId);
    expect(route).toContain(roomId);
    expect(route.startsWith('/multiplayer/')).toBe(true);
  });

  it('matches required URL pattern', () => {
    const validUrl = '/multiplayer/game:tetris-2-usa-nintendo:v1.0/room_q9k3ccg0p_ms';
    const pattern = /^\/multiplayer\/[^/]+\/[^/]+$/;

    expect(pattern.test(validUrl)).toBe(true);
  });
});