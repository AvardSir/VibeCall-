import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../../shared/i18n';
import { DeviceToggles } from './DeviceToggles';
import { useMediaStore } from '../../../stores/useMediaStore';

describe('DeviceToggles', () => {
  beforeEach(() => {
    useMediaStore.setState({
      isMicOn: true,
      isCamOn: true,
      micPermission: 'granted',
      cameraPermission: 'granted',
    });
  });

  it('renders round icon controls (glyphs, not text) for mic and camera', () => {
    const { container } = render(<DeviceToggles />);
    const micBtn = screen.getByRole('button', { name: 'Mute microphone' });
    expect(micBtn).toHaveClass('size-12', 'rounded-[30px]');
    // glyph is an inlined SVG, matching the in-call controls
    expect(container.querySelectorAll('button svg').length).toBe(2);
  });

  it('toggles mic and camera through the media store', async () => {
    render(<DeviceToggles />);
    await userEvent.click(screen.getByRole('button', { name: 'Mute microphone' }));
    expect(useMediaStore.getState().isMicOn).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Turn camera off' }));
    expect(useMediaStore.getState().isCamOn).toBe(false);
  });

  it('disables a control when its device permission is denied', () => {
    useMediaStore.setState({ cameraPermission: 'denied' });
    render(<DeviceToggles />);
    expect(screen.getByRole('button', { name: 'Turn camera off' })).toBeDisabled();
  });
});
