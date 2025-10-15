import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './popup.css';

import { SavedTextItem } from '../types';

function Popup() {
  const [savedWords, setSavedWords] = useState<SavedTextItem[]>([]);
  const [translator, setTranslator] = useState<TranslatorObject | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [showLoadingExport, setShowLoadingExport] = useState<boolean>(false);

  useEffect(() => {
    const loadTranslator = async () => {
      const translatorInstance = await Translator.create({
        sourceLanguage: 'en',
        targetLanguage: 'pt-BR',
        monitor(m: {
          addEventListener: (event: string, cb: (e: { loaded: number }) => void) => void;
        }) {
          m.addEventListener('downloadprogress', (e: { loaded: number }) => {
            const pct = Math.max(0, Math.min(1, e.loaded));
            setProgress(Math.round(pct * 100));
          });
        },
      });
      const inst = await translatorInstance;
      setTranslator(inst);
    };
    chrome.storage.sync.get(['savedWords'], (result) => {
      console.log('Loaded words:', result.savedWords);
      setSavedWords(result.savedWords || []);
    });

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.savedWords) {
        console.log('Words updated:', changes.savedWords.newValue);
        setSavedWords(changes.savedWords.newValue || []);
      }
    });

    loadTranslator();
  }, []);

  const handleDelete = (wordToDelete: SavedTextItem) => {
    chrome.storage.sync.get(['savedWords'], (result) => {
      const updatedWords = (result.savedWords || []).filter(
        (word: SavedTextItem) => word.id !== wordToDelete.id
      );
      chrome.storage.sync.set({ savedWords: updatedWords }, () => {
        setSavedWords(updatedWords);
      });
    });
  };

  const handleCopiar = async () => {
    setShowLoadingExport(true);

    const promisses = savedWords.map(async (word) => {
      const wordTranslated = await translator?.translate(word.content.selected);
      const fullPhaseTranslated = await translator?.translate(word.fullText);
      return `${wordTranslated}; ${word.content.before} <b>${wordTranslated}</b> ${word.content.after}; ${word.content.before} <b>${word.content.selected}</b> ${word.content.after}; ${fullPhaseTranslated}`;
    });
    const results = await Promise.all(promisses);

    const textoParaCopiar = results.join('\n');

    try {
      await navigator.clipboard.writeText(textoParaCopiar);
      console.log('Texto copiado com sucesso!');
      setShowLoadingExport(false);
    } catch (err) {
      console.error('Erro ao copiar para a área de transferência:', err);
      setShowLoadingExport(false);
    }
  };

  return (
    <div className="popup-container">
      <h1>Saved Words</h1>
      {progress > 0 && progress < 100 && (
        <div className="progress-wrap" aria-hidden>
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="export-wrap">
        <button
          className={`export-button ${showLoadingExport ? 'loading' : ''}`}
          onClick={handleCopiar}
          title="Exportar"
          aria-label="Exportar"
          disabled={showLoadingExport}
        >
          {showLoadingExport ? (
            <span className="spinner" aria-hidden />
          ) : (
            'Export'
          )}
        </button>
      </div>
      <div className="word-list">
        {savedWords.length === 0 ? (
          <p className="no-words">No words saved yet.</p>
        ) : (
          savedWords.map((word) => (
            <div key={word.id} className="word-item">
              <div className="word-header">
                <h3 className="word-text">{word.content.selected}</h3>
                <button
                  onClick={() => handleDelete(word)}
                  className="action-button delete"
                  title="Remove from list"
                  aria-label="Remove from list"
                >
                  ✕
                </button>
              </div>
              <p className="word-context">
                {word.content.before} <span className="highlight">{word.content.selected}</span>{' '}
                {word.content.after}
              </p>
              <p className="word-date">{new Date(word.timestamp).toLocaleDateString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const root = document.createElement('div');
root.id = 'root';
document.body.appendChild(root);

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
