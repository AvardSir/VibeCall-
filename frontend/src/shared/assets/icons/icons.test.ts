import { describe, it, expect } from 'vitest';
import { ICONS, type IconName } from './index';

const NAMES: IconName[] = ['micOn', 'micOff', 'camOn', 'camOff', 'hangup', 'chat', 'arrow', 'send', 'screenShare', 'link'];

describe('icon barrel', () => {
  it('exports valid SVG markup for every glyph', () => {
    for (const name of NAMES) {
      expect(ICONS[name], name).toContain('<svg');
    }
  });

  it('uses currentColor so the Icon component controls color', () => {
    for (const name of NAMES) {
      expect(ICONS[name], name).toContain('currentColor');
    }
  });
});
