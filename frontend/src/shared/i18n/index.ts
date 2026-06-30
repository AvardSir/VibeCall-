import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { ru } from './ru';

export const i18nReady = i18n.use(initReactI18next).init({
  resources: { en: en, ru: ru },
  lng: 'en',
  fallbackLng: 'en',
  ns: ['common', 'prejoin', 'call', 'roomStates', 'chat'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export default i18n;
