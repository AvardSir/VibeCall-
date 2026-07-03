import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageSelector } from './LanguageSelector';

const baseProps = { groupLabel: 'Language' };

describe('LanguageSelector', () => {
  it('marks the active language as pressed', () => {
    render(<LanguageSelector language="en" onChange={vi.fn()} {...baseProps} />);
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'RU' })).toHaveAttribute('aria-pressed', 'false');
    // NFR-2: explicit theme-aware focus-visible ring, not the browser default outline
    expect(screen.getByRole('button', { name: 'EN' })).toHaveClass(
      'focus-visible:outline-2',
      'focus-visible:outline-accent',
    );
  });

  it('calls onChange with the chosen language', () => {
    const onChange = vi.fn();
    render(<LanguageSelector language="en" onChange={onChange} {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'RU' }));
    expect(onChange).toHaveBeenCalledWith('ru');
  });
});
