import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './locales/es.json';
import en from './locales/en.json';
import ca from './locales/ca.json';

void i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
    ca: { translation: ca }
  },
  lng: 'es',
  fallbackLng: 'es',
  supportedLngs: ['es', 'ca', 'en'],
  interpolation: {
    escapeValue: false
  }
});

const configuredI18n = i18n;

export default configuredI18n;

