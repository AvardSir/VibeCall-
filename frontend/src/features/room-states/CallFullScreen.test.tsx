import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../shared/i18n';
import { CallFullScreen } from './CallFullScreen';

describe('CallFullScreen', () => {
  it('shows the verbatim full-call strings and fires back-to-home', () => {
    const onBack = vi.fn();
    render(<CallFullScreen onBackToHome={onBack} />);
    expect(screen.getByText('This call is full.')).toBeInTheDocument();
    expect(screen.getByText('Only four participants can join at a time.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to home' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
