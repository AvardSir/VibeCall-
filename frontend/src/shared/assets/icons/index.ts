import micOn from './mic-on.svg?raw';
import micOff from './mic-off.svg?raw';
import camOn from './cam-on.svg?raw';
import camOff from './cam-off.svg?raw';
import hangup from './hangup.svg?raw';
import chat from './chat.svg?raw';
import arrow from './arrow.svg?raw';
import send from './send.svg?raw';
import screenShare from './screen-share.svg?raw';
import link from './link.svg?raw';

export type IconName =
  | 'micOn' | 'micOff' | 'camOn' | 'camOff'
  | 'hangup' | 'chat' | 'arrow' | 'send' | 'screenShare' | 'link';

// Raw SVG markup, imported at build time. All glyphs use fill/stroke="currentColor",
// so the consuming <Icon> component sets the color per placement (M7b Task 1).
export const ICONS: Record<IconName, string> = {
  micOn, micOff, camOn, camOff, hangup, chat, arrow, send, screenShare, link,
};
