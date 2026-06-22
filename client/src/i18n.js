import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import uk from './locales/uk.json';
import ru from './locales/ru.json';

i18n.use(initReactI18next).init({
  resources: {
    uk: { translation: uk },
    ru: { translation: ru },
  },
  lng: localStorage.getItem('language') || 'uk',
  fallbackLng: 'uk',
  interpolation: { escapeValue: false },
});

export default i18n;
