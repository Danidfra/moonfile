import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import GameControls from './GameControls';

describe('GameControls', () => {
  it('renders keyboard controls with all mappings', () => {
    render(
      <TestApp>
        <GameControls />
      </TestApp>
    );

    expect(screen.getByText('Keyboard Controls')).toBeInTheDocument();

    // Check for control mappings
    expect(screen.getByText('D-Pad')).toBeInTheDocument();
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getAllByText('Select')).toHaveLength(2); // Both action and description
    expect(screen.getByText('B Button')).toBeInTheDocument();
    expect(screen.getByText('A Button')).toBeInTheDocument();
  });

  it('shows keyboard key badges', () => {
    render(
      <TestApp>
        <GameControls />
      </TestApp>
    );

    // Check for key badges
    expect(screen.getByText('↑')).toBeInTheDocument();
    expect(screen.getByText('Enter')).toBeInTheDocument();
    expect(screen.getByText('Z')).toBeInTheDocument();
    expect(screen.getByText('X')).toBeInTheDocument();
  });

  it('displays help text about focusing game area', () => {
    render(
      <TestApp>
        <GameControls />
      </TestApp>
    );

    expect(screen.getByText(/Controls work when the game area is focused/)).toBeInTheDocument();
  });

  it('renders as floating variant when specified', () => {
    render(
      <TestApp>
        <GameControls variant="floating" />
      </TestApp>
    );

    // Should still show the controls but in floating layout
    expect(screen.getByText('Keyboard Controls')).toBeInTheDocument();
  });
});