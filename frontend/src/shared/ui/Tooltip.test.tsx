import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('renders the trigger child', () => {
    render(
      <Tooltip label="Leave the call">
        <button type="button">Leave</button>
      </Tooltip>,
    );
    expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument();
  });

  it('exposes the label via a tooltip role, without changing the trigger accessible name', () => {
    render(
      <Tooltip label="Leave the call">
        <button type="button">Leave</button>
      </Tooltip>,
    );
    expect(screen.getByRole('tooltip')).toHaveTextContent('Leave the call');
    // The tooltip bubble is a sibling, so the button's accessible name stays "Leave".
    expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument();
  });

  it('renders a white Figma bubble with the label', () => {
    render(
      <Tooltip label="Turn off camera">
        <button type="button">cam</button>
      </Tooltip>,
    );
    const bubble = screen.getByRole('tooltip');
    expect(bubble).toHaveTextContent('Turn off camera');
    expect(bubble).toHaveClass('bg-slate-800', 'text-white', 'rounded-[8px]', 'px-3', 'py-1.5', 'text-sm', 'font-semibold');
  });

  it('places above the trigger by default and below when placement="bottom"', () => {
    const { rerender } = render(
      <Tooltip label="x">
        <button type="button">t</button>
      </Tooltip>,
    );
    expect(screen.getByRole('tooltip')).toHaveClass('bottom-full');

    rerender(
      <Tooltip label="x" placement="bottom">
        <button type="button">t</button>
      </Tooltip>,
    );
    expect(screen.getByRole('tooltip')).toHaveClass('top-full');
  });

  it('reveals the bubble only after the hover delay', () => {
    vi.useFakeTimers();
    try {
      render(
        <Tooltip label="Mute">
          <button type="button">m</button>
        </Tooltip>,
      );
      const wrapper = screen.getByRole('button', { name: 'm' }).parentElement as HTMLElement;
      const bubble = screen.getByRole('tooltip');
      fireEvent.pointerEnter(wrapper);
      expect(bubble).toHaveClass('opacity-0'); // still hidden during the delay
      act(() => vi.advanceTimersByTime(400));
      expect(bubble).toHaveClass('opacity-100');
      fireEvent.pointerLeave(wrapper);
      expect(bubble).toHaveClass('opacity-0');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows only one tooltip at a time (opening a second closes the first)', () => {
    vi.useFakeTimers();
    try {
      render(
        <>
          <Tooltip label="Alpha">
            <button type="button">a</button>
          </Tooltip>
          <Tooltip label="Beta">
            <button type="button">b</button>
          </Tooltip>
        </>,
      );
      const wrapA = screen.getByRole('button', { name: 'a' }).parentElement as HTMLElement;
      const wrapB = screen.getByRole('button', { name: 'b' }).parentElement as HTMLElement;
      const bubbleA = screen.getByText('Alpha');
      const bubbleB = screen.getByText('Beta');

      fireEvent.pointerEnter(wrapA);
      act(() => vi.advanceTimersByTime(400));
      expect(bubbleA).toHaveClass('opacity-100');

      fireEvent.pointerEnter(wrapB);
      act(() => vi.advanceTimersByTime(400));
      expect(bubbleB).toHaveClass('opacity-100');
      expect(bubbleA).toHaveClass('opacity-0'); // the first was auto-closed
    } finally {
      vi.useRealTimers();
    }
  });
});
