// Language detection service

export class LanguageDetectorService {
  private static detector: any = null;

  static async detectLanguage(text: string): Promise<string> {
    if (!("LanguageDetector" in self)) {
      throw new Error("LanguageDetector is not supported.");
    }

    // Create detector only once
    if (!this.detector) {
      this.detector = await (self as any).LanguageDetector.create();
    }

    const { detectedLanguage } = (await this.detector.detect(text))[0];
    return detectedLanguage;
  }
}
