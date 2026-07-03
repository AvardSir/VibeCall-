import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders Figma base geometry and the primary variant by default', () => {
    render(<Button>Join</Button>);
    const el = screen.getByRole('button', { name: 'Join' });
    expect(el).toHaveClass('rounded-[10px]', 'px-7', 'py-3', 'text-base', 'font-[452]');
    expect(el).toHaveClass('bg-accent', 'text-white', 'hover:bg-accent-strong');
    // NFR-2: explicit theme-aware focus-visible ring, not the browser default outline
    expect(el).toHaveClass('focus-visible:outline-2', 'focus-visible:outline-accent');
    expect(el).toHaveAttribute('type', 'button');
  });

  it('renders the secondary (white) variant', () => {
    render(<Button variant="secondary">Back</Button>);
    const el = screen.getByRole('button', { name: 'Back' });
    expect(el).toHaveClass('bg-slate-800', 'text-white', 'hover:bg-slate-700');
  });

  it('stretches to full width when fullWidth is set', () => {
    const { rerender } = render(<Button>Join</Button>);
    expect(screen.getByRole('button', { name: 'Join' })).not.toHaveClass('w-full');
    rerender(<Button fullWidth>Join</Button>);
    expect(screen.getByRole('button', { name: 'Join' })).toHaveClass('w-full');
  });

  it('renders the danger variant', () => {
    render(<Button variant="danger">End call</Button>);
    expect(screen.getByRole('button', { name: 'End call' })).toHaveClass('bg-danger', 'text-white');
  });

  it('fires onClick and respects disabled', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1); // still 1 — disabled swallows the click
  });
});
