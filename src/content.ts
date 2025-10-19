import { SavedTextContent, ContextMenuMessage } from './types';

let ctrlPressed = false;
let lastCtrlPress = 0;

/**
 * Find a parent element that contains the provided text by scanning text nodes.
 * Returns the element node (parent of the text node) or null if not found.
 */
function findContainerForText(target: string): Node | null {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node): number {
      const nv = node.nodeValue || '';
      return nv.includes(target) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  } as unknown as NodeFilter);

  const textNode = walker.nextNode();
  return textNode ? textNode.parentNode : null;
}

function buildSavedItemFrom(container: Node, selectedText: string) {
  const fullText = (container.textContent || '').trim();
  const selectedStart = fullText.indexOf(selectedText);
  if (selectedStart === -1) return null;

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

  return savedItem;
}

chrome.runtime.onMessage.addListener((contextMenuMessage: ContextMenuMessage) => {
  if (contextMenuMessage.action === 'contextMenuSelection') {

    const selectedTextFromContextMenu = contextMenuMessage.text.trim();
    if (!selectedTextFromContextMenu) return;

    // Prefer the current selection if it matches the context-menu text
    let textContainer: Node | null = null;
    const currentSelection = window.getSelection();
    if (
      currentSelection &&
      currentSelection.toString().trim() === selectedTextFromContextMenu &&
      currentSelection.rangeCount
    ) {
      let ancestorNode = currentSelection.getRangeAt(0).commonAncestorContainer;
      while (ancestorNode && ancestorNode.nodeType !== Node.ELEMENT_NODE) {
        ancestorNode = ancestorNode.parentNode as Node;
      }
      textContainer = ancestorNode;
    }

    // Fallback: find a container that contains the text
    if (!textContainer) {
      textContainer = findContainerForText(selectedTextFromContextMenu);
    }

    if (!textContainer) return;

    const itemToSave = buildSavedItemFrom(textContainer, selectedTextFromContextMenu);
    if (!itemToSave) return;

    // Send the same message the Ctrl-double-press flow uses
    chrome.runtime.sendMessage({
      action: 'saveWord',
      data: itemToSave,
    });
  }
});

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
