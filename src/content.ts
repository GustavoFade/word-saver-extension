import { SavedTextContent } from './types';

let ctrlPressed = false;
let lastCtrlPress = 0;

const saveSelectedTextWithContext = () => {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  const selectedText = selection.toString().trim();
  if (!selectedText) return;

  let container = range.commonAncestorContainer;
  while (container && container.nodeType !== Node.ELEMENT_NODE) {
    container = container.parentNode as Node;
  }
  if (!container) return;

  const fullText = container.textContent || '';
  const selectedStart = fullText.indexOf(selectedText);
  if (selectedStart === -1) return;

  const beforeText = fullText.slice(0, selectedStart);
  const afterText = fullText.slice(selectedStart + selectedText.length);

  const beforeMatch = beforeText.match(/([.!?])[\s\n]*([^.!?]*)$/);
  const beforeBoundary = beforeMatch ? beforeText.lastIndexOf(beforeMatch[1]) + 1 : 0;

  const afterMatch = afterText.match(/([.!?])/);
  const afterBoundary = afterMatch
    ? selectedStart + selectedText.length + afterMatch.index! + 1
    : fullText.length;

  const sentence = fullText.slice(beforeBoundary, afterBoundary).trim();

  const sentenceSelectedStart = sentence.indexOf(selectedText);
  const beforeContext = sentence.slice(0, sentenceSelectedStart);
  const afterContext = sentence.slice(sentenceSelectedStart + selectedText.length);

  const savedText: SavedTextContent = {
    before: beforeContext.trim(),
    selected: selectedText,
    after: afterContext.trim(),
  };

  const savedItem = {
    id: Date.now().toString(),
    content: savedText,
    timestamp: Date.now(),
    fullText: `...${savedText.before} **${savedText.selected}** ${savedText.after}...`,
  };

  chrome.runtime.sendMessage({
    action: 'saveWord',
    data: savedItem,
  });
};

document.addEventListener('keydown', (event) => {
  if (event.key === 'Control') {
    const now = Date.now();
    if (ctrlPressed && now - lastCtrlPress < 500) {
      saveSelectedTextWithContext();
      ctrlPressed = false;
    } else {
      ctrlPressed = true;
      lastCtrlPress = now;
    }
  }
});

document.addEventListener('keyup', (event) => {
  if (event.key === 'Control') {
    setTimeout(() => {
      ctrlPressed = false;
    }, 500);
  }
});
