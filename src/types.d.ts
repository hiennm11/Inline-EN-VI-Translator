// Additional type declarations for the translator API

declare interface Self {
  Translator: {
    availability(options: {
      sourceLanguage: string;
      targetLanguage: string;
    }): Promise<string>;
    create(options: {
      sourceLanguage: string;
      targetLanguage: string;
      monitor?: (m: any) => void;
    }): Promise<any>;
  };
  LanguageDetector: {
    create(): Promise<any>;
  };
}