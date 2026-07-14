import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Text } from './Text';

describe('Text', () => {
  it('renders a <span> with default size/weight classes', () => {
    render(<Text>hello</Text>);
    const el = screen.getByText('hello');
    expect(el.tagName).toBe('SPAN');
    // default size=md → text-base leading-6; default weight=regular → font-light (Figma 300)
    expect(el).toHaveClass('text-base', 'leading-6', 'font-light');
  });

  it('renders the requested tag with mapped size and weight classes', () => {
    render(
      <Text tag="h1" size="2xl" weight="semibold">
        title
      </Text>,
    );
    const el = screen.getByText('title');
    expect(el.tagName).toBe('H1');
    // size=2xl → text-[22px] leading-[30px] (Figma H1); weight=semibold → font-semibold (600)
    expect(el).toHaveClass('text-[22px]', 'leading-[30px]', 'font-semibold');
  });

  it('applies transform classes; capitalize is suppressed when uppercase is set', () => {
    const { rerender } = render(
      <Text center capitalize>
        a
      </Text>,
    );
    let el = screen.getByText('a');
    expect(el).toHaveClass('text-center', 'capitalize');
    expect(el).not.toHaveClass('uppercase');

    rerender(
      <Text uppercase capitalize>
        a
      </Text>,
    );
    el = screen.getByText('a');
    expect(el).toHaveClass('uppercase');
    expect(el).not.toHaveClass('capitalize');
  });

  it('merges a caller className and forwards pass-through HTML attributes', () => {
    render(
      <Text className="text-slate-400" id="note" data-testid="t">
        body
      </Text>,
    );
    const el = screen.getByTestId('t');
    expect(el).toHaveClass('text-base', 'text-slate-400');
    expect(el).toHaveAttribute('id', 'note');
  });

  it('asChild renders the child element (no wrapper) and merges classes onto it', () => {
    render(
      <Text asChild size="lg" weight="bold" className="text-red-500">
        <a href="/x" className="underline">
          link
        </a>
      </Text>,
    );
    const el = screen.getByRole('link', { name: 'link' });
    expect(el.tagName).toBe('A');
    expect(el).toHaveAttribute('href', '/x');
    // slot styles + the child's own className are both present
    // weight=bold → font-extrabold (Figma 800)
    expect(el).toHaveClass('text-lg', 'font-extrabold', 'text-red-500', 'underline');
  });
});
