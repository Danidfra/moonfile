import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import MultiplayerChat from './MultiplayerChat';

describe('MultiplayerChat', () => {
  it('renders chat component with title', () => {
    render(
      <TestApp>
        <MultiplayerChat />
      </TestApp>
    );

    expect(screen.getByText('Player Chat')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
  });

  it('shows host chat title when isHost is true', () => {
    render(
      <TestApp>
        <MultiplayerChat isHost={true} />
      </TestApp>
    );

    expect(screen.getByText('Host Chat')).toBeInTheDocument();
  });

  it('displays online count when provided', () => {
    render(
      <TestApp>
        <MultiplayerChat onlineCount={5} />
      </TestApp>
    );

    expect(screen.getByText('5 online')).toBeInTheDocument();
  });

  it('calls onSendMessage when message is sent', () => {
    const mockSendMessage = vi.fn();

    render(
      <TestApp>
        <MultiplayerChat onSendMessage={mockSendMessage} />
      </TestApp>
    );

    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByRole('button', { name: '' }); // Send button with icon

    fireEvent.change(input, { target: { value: 'Hello world' } });
    fireEvent.click(sendButton);

    expect(mockSendMessage).toHaveBeenCalledWith('Hello world');
  });

  it('sends message on Enter key press', () => {
    const mockSendMessage = vi.fn();

    render(
      <TestApp>
        <MultiplayerChat onSendMessage={mockSendMessage} />
      </TestApp>
    );

    const input = screen.getByPlaceholderText('Type your message...');

    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: false });

    expect(mockSendMessage).toHaveBeenCalledWith('Test message');
  });

  it('disables send button when message is empty', () => {
    render(
      <TestApp>
        <MultiplayerChat />
      </TestApp>
    );

    const sendButton = screen.getByRole('button', { name: '' });
    expect(sendButton).toBeDisabled();
  });
});