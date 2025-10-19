import { SavedTextItem, ContextMenuMessage } from './types';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'saveSelectedWord',
    title: 'Save word',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'saveSelectedWord' && tab?.id && info.selectionText) {
    const message: ContextMenuMessage = {
      action: 'contextMenuSelection',
      text: info.selectionText,
    };
    chrome.tabs.sendMessage(tab.id, message);
  }
});

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
