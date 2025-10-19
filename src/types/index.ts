export interface SavedTextContent {
  before: string;
  selected: string;
  after: string;
}

export interface SavedTextItem {
  id: string;
  content: SavedTextContent;
  timestamp: number;
  fullText: string;
}

export type StorageData = {
  savedWords: SavedTextItem[];
};

export interface ContextMenuMessage {
  action: 'contextMenuSelection';
  text: string;
}
