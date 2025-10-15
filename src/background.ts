import { SavedTextItem } from './types';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveWord') {
    chrome.storage.sync.get(['savedWords'], (result: { savedWords?: SavedTextItem[] }) => {
      const currentWords = result.savedWords || [];

      const newWord: SavedTextItem = {
        id: Date.now().toString(),
        content: request.data.content,
        timestamp: Date.now(),
        fullText: `...${request.data.content.before} ${request.data.content.selected} ${request.data.content.after}...`,
      };

      const newWords = [...currentWords, newWord];
      chrome.storage.sync.set({ savedWords: newWords });
    });
  }
});
