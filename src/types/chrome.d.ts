declare namespace chrome.i18n {
  interface TranslationResult {
    translatedText: string;
    sourceLanguage: string;
    targetLanguage: string;
  }

  interface ModelConfig {
    sourceLanguage: string;
    targetLanguage: string;
  }

  interface TranslatorOptions {
    modelConfig: ModelConfig;
    downloadProgress?: (progress: number) => void;
  }

  interface Translator {
    translateText(text: string): Promise<TranslationResult>;
  }

  function getTranslator(options?: TranslatorOptions): Promise<Translator>;
}
