import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../../shared/i18n';
import { NameInput } from './NameInput';

describe('NameInput', () => {
  it('renders the Figma field with a placeholder and no visible label text', () => {
    render(<NameInput value="" onChange={() => {}} errorKey={null} showError={false} />);
    const input = screen.getByPlaceholderText('Name');
    expect(input).toHaveClass('bg-surface-muted', 'rounded-[11px]', 'w-[332px]');
    // accessible name comes from the sr-only label, not visible chrome
    expect(input).toHaveAccessibleName('Your name');
  });

  it('shows the inline error with a "*" prefix when showError and errorKey are set', () => {
    render(<NameInput value="" onChange={() => {}} errorKey="nameEmpty" showError />);
    // getByText matches the inner message span; the color + "*" prefix live on its parent row.
    const errorRow = screen.getByText('Please enter your name').parentElement;
    expect(errorRow).toHaveClass('text-danger');
    expect(errorRow?.textContent).toMatch(/^\*/); // asterisk prefix present
  });

  it('hides the error when showError is false', () => {
    render(<NameInput value="" onChange={() => {}} errorKey="nameEmpty" showError={false} />);
    expect(screen.queryByText(/Please enter your name/)).toBeNull();
  });
});
