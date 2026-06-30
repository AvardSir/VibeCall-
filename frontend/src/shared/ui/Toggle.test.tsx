import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toggle } from './Toggle';

describe('Toggle', () => {
  it('exposes a switch with the label as its accessible name', () => {
    render(<Toggle label="Microphone" pressed={false} onChange={vi.fn()} />);
    expect(screen.getByRole('switch', { name: 'Microphone' })).toBeInTheDocument();
  });

  it('reflects the pressed state via aria-checked', () => {
    render(<Toggle label="Microphone" pressed onChange={vi.fn()} />);
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('calls onChange with the toggled value on click', () => {
    const onChange = vi.fn();
    render(<Toggle label="Microphone" pressed={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not fire onChange when disabled', () => {
    const onChange = vi.fn();
    render(<Toggle label="Microphone" pressed={false} disabled onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
