import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  it('exposes the given accessible label and fires onToggle on click', () => {
    const onToggle = vi.fn();
    render(<ThemeToggle theme="dark" label="Switch to light theme" onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Switch to light theme' });
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
