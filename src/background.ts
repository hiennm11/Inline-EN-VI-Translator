chrome.runtime.onInstalled.addListener(async () => {
  await initState();
});

chrome.action.onClicked.addListener(async (tab) => {
  await initState(tab);
});

async function initState(tab?: chrome.tabs.Tab): Promise<void> {
  chrome.storage.sync.get("translator_on", async (result: { translator_on?: boolean }) => {
    const translator_on = result.translator_on || false;
    const newStatus = !translator_on;
    chrome.storage.sync.set({ translator_on: newStatus });
    chrome.action.setBadgeText({
      text: newStatus ? "ON" : "OFF",
      tabId: tab?.id,
    });

    if (newStatus) {
      await initTranslator("en");
      await initTranslator("vi");
    }

    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        action: "toggleTranslator",
        enabled: newStatus,
      });
    }
  });
}

async function initTranslator(sourceLanguage = "en"): Promise<void> {
  if (!("Translator" in self)) {
    throw new Error("Translator is not supported.");
  }

  const targetLanguage = sourceLanguage === "en" ? "vi" : "en";

  const availability = await (self as any).Translator.availability({
    sourceLanguage,
    targetLanguage,
  });
  const isUnavailable = availability === "unavailable";

  if (isUnavailable) {
    console.log(`${sourceLanguage} - ${targetLanguage} pair is not supported.`);
    return;
  }

  await (self as any).Translator.create({
    sourceLanguage,
    targetLanguage,
    monitor(m: any) {
      m.addEventListener("downloadprogress", (e: any) => {
        console.log(
          `Downloaded ${sourceLanguage} - ${targetLanguage}: ${e.loaded * 100}%`
        );
      });
    },
  });
}