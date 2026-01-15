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

export interface SavedPdfPage {
  page: number;
  text: string;
}

export interface SavedPdf {
  id: string;
  filename: string;
  pages: SavedPdfPage[];
  timestamp: number;
}

export interface ContextMenuMessage {
  action: 'contextMenuSelection';
  text: string;
}
