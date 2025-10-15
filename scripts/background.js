chrome.runtime.onInstalled.addListener(async () => {
  await initState();
});

chrome.action.onClicked.addListener(async (tab) => {
  await initState(tab);
});

async function initState(tab) {
  chrome.storage.sync.get("translator_on", async ({ translator_on }) => {
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

async function initTranslator(sourceLanguage = "en") {
  if (!("Translator" in self)) {
    throw new Error("Translator is not supported.");
  }

  const targetLanguage = sourceLanguage === "en" ? "vi" : "en";

  const availability = await Translator.availability({
    sourceLanguage,
    targetLanguage,
  });
  const isUnavailable = availability === "unavailable";

  if (isUnavailable) {
    console.log(`${sourceLanguage} - ${targetLanguage} pair is not supported.`);
    transElem.textContent = "Translation not available for this language pair.";
    return;
  }

  translator = await Translator.create({
    sourceLanguage,
    targetLanguage,
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => {
        console.log(
          `Downloaded ${sourceLanguage} - ${targetLanguage}: ${e.loaded * 100}%`
        );
      });
    },
  });
}
