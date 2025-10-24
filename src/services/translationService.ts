// Translation service

export class TranslationService {
  private translators: Record<string, any> = {};

  async getTranslatorInstance(
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<any | null> {
    const translatorKey = `${sourceLanguage}-${targetLanguage}`;

    // Check availability
    const availability = await (self as any).Translator.availability({
      sourceLanguage,
      targetLanguage,
    });

    if (availability === "unavailable") {
      console.log(
        `${sourceLanguage} - ${targetLanguage} pair is not supported.`
      );
      return null;
    }

    // Use existing translator or create a new one
    if (!this.translators[translatorKey]) {
      this.translators[translatorKey] = await (self as any).Translator.create({
        sourceLanguage,
        targetLanguage,
      });
    }

    return this.translators[translatorKey];
  }

  async translateText(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    updateCallback?: (text: string) => void
  ): Promise<string> {
    try {
      if (!("Translator" in self)) {
        throw new Error("Translator is not supported.");
      }

      const translator = await this.getTranslatorInstance(
        sourceLanguage,
        targetLanguage
      );

      if (!translator) {
        return "Translation not available for this language pair.";
      }

      let translatedText = "";

      // Use the streaming API
      const stream = translator.translateStreaming(text);
      for await (const chunk of stream) {
        translatedText += chunk;

        // Call update callback if provided
        if (updateCallback) {
          updateCallback(translatedText);
        }
      }

      return translatedText;
    } catch (err) {
      console.error("Translation error:", err);
      return "An error occurred. Please try again.";
    }
  }
}
