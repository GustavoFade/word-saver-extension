interface TranslatorOptions {
  sourceLanguage: string;
  targetLanguage: string;
  monitor?: (m: {
    addEventListener: (event: string, callback: (e: { loaded: number }) => void) => void;
  }) => void;
}

interface TranslatorObject {
  translate(text: string): Promise<{ translatedText: string }>;
}

interface TranslatorNamespace {
  create(options: TranslatorOptions): TranslatorObject;
}

declare var Translator: TranslatorNamespace;
