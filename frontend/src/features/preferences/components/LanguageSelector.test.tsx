import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageSelector } from './LanguageSelector';

const baseProps = {
  groupLabel: 'Language',
  englishLabel: 'English',
  russianLabel: 'Russian',
};

describe('LanguageSelector', () => {
  it('marks the active language as pressed', () => {
    render(<LanguageSelector language="en" onChange={vi.fn()} {...baseProps} />);
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Russian' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the chosen language', () => {
    const onChange = vi.fn();
    render(<LanguageSelector language="en" onChange={onChange} {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Russian' }));
    expect(onChange).toHaveBeenCalledWith('ru');
  });
});
