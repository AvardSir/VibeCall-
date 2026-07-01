import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FileChip } from './FileChip';

describe('FileChip', () => {
  it('renders the file name, a humanized size, and a download link', () => {
    render(
      <FileChip name="report.pdf" size={2048} href="/attachments/report.pdf?token=m1" downloadLabel="Download" />,
    );

    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /download: report\.pdf/i });
    expect(link).toHaveAttribute('href', '/attachments/report.pdf?token=m1');
    expect(link).toHaveAttribute('download', 'report.pdf');
  });

  it('opens in a new tab so a cross-origin download never navigates the call away', () => {
    render(
      <FileChip name="report.pdf" size={2048} href="http://localhost:3000/attachments/x?token=m1" downloadLabel="Download" />,
    );
    const link = screen.getByRole('link', { name: /download: report\.pdf/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
