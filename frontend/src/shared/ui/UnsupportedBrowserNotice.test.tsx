import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../i18n';

const isBrowserSupported = vi.fn();
vi.mock('../lib/detectBrowser', () => ({
  isBrowserSupported: () => isBrowserSupported(),
}));

import { UnsupportedBrowserNotice } from './UnsupportedBrowserNotice';

const UNSUPPORTED_TEXT = /your browser may not support video calls/i;

beforeEach(() => {
  isBrowserSupported.mockReset();
});

describe('UnsupportedBrowserNotice', () => {
  it('renders the verbatim notice when the browser is unsupported', () => {
    isBrowserSupported.mockReturnValue(false);
    render(<UnsupportedBrowserNotice />);
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent(UNSUPPORTED_TEXT);
  });

  it('renders nothing when the browser is supported', () => {
    isBrowserSupported.mockReturnValue(true);
    const { container } = render(<UnsupportedBrowserNotice />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
