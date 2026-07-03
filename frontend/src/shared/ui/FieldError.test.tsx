import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FieldError } from './FieldError';

describe('FieldError', () => {
  it('renders the message in danger red with a "*" prefix by default', () => {
    render(<FieldError>Please enter your name</FieldError>);
    const row = screen.getByText('Please enter your name').parentElement;
    expect(row).toHaveClass('text-danger', 'text-sm', 'font-light');
    expect(row?.textContent).toMatch(/^\*/);
  });

  it('omits the asterisk when asterisk={false}', () => {
    render(<FieldError asterisk={false}>Unable to start a call</FieldError>);
    const row = screen.getByText('Unable to start a call').parentElement;
    expect(row?.textContent).not.toMatch(/^\*/);
    expect(row).toHaveClass('text-danger');
  });
});
