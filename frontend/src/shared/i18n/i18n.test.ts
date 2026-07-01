import { describe, it, expect } from 'vitest';
import { en } from './en';
import { ru } from './ru';

describe('i18n resources', () => {
  it('en and ru expose identical keys in every namespace', () => {
    const namespaces = Object.keys(en) as (keyof typeof en)[];
    for (const ns of namespaces) {
      expect(Object.keys(ru[ns]).sort()).toEqual(Object.keys(en[ns]).sort());
    }
  });

  it('common carries the theme and language control strings', () => {
    expect(en.common.themeSwitchToLight).toBeTruthy();
    expect(en.common.themeSwitchToDark).toBeTruthy();
    expect(en.common.language).toBeTruthy();
  });
});
