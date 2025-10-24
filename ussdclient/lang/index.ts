import { en, TranslationKeys } from './en';
import { fr } from './fr';

export type Language = 'en' | 'fr';

const translations: Record<Language, TranslationKeys> = {
  en,
  fr,
};

export class LanguageManager {
  private currentLanguage: Language = 'en';

  constructor(language: Language = 'en') {
    this.currentLanguage = language;
  }

  /**
   * Set the current language
   */
  setLanguage(language: Language): void {
    if (translations[language]) {
      this.currentLanguage = language;
    } else {
      console.warn(`Language '${language}' not supported. Defaulting to 'en'.`);
      this.currentLanguage = 'en';
    }
  }

  /**
   * Get the current language
   */
  getLanguage(): Language {
    return this.currentLanguage;
  }

  /**
   * Get a translated string by key
   * Supports interpolation with {{variable}} syntax
   */
  t(key: keyof TranslationKeys, params?: Record<string, string | number>): string {
    let text = translations[this.currentLanguage][key];

    // Replace interpolation placeholders
    if (params) {
      Object.keys(params).forEach((param) => {
        text = text.replace(new RegExp(`{{${param}}}`, 'g'), String(params[param]));
      });
    }

    return text;
  }

  /**
   * Get all available languages
   */
  static getAvailableLanguages(): Language[] {
    return Object.keys(translations) as Language[];
  }
}

export { en, fr };

