import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './popup.css';

import { SavedTextItem, SavedPdf } from '../types';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';
import { savePdfRecord, getPdfRecord, deletePdfRecord, getAllPdfRecords, StoredPdfRecord } from '../storage/indexedDb';

// Set workerSrc for pdfjs (webpack will handle worker entry)
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfjsWorker;

function Popup() {
  const [savedWords, setSavedWords] = useState<SavedTextItem[]>([]);
  const [translator, setTranslator] = useState<TranslatorObject | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [showLoadingExport, setShowLoadingExport] = useState<boolean>(false);
  const [pdfTextPages, setPdfTextPages] = useState<Array<{ page: number; text: string }>>([]);
  const [pdfFilename, setPdfFilename] = useState<string | null>(null);
  const [gotoPage, setGotoPage] = useState<number | ''>('');
  const pdfPagesRef = React.useRef<HTMLDivElement | null>(null);
  // savedPdfs holds lightweight metadata (id, filename, pagesCount, timestamp)
  const [savedPdfs, setSavedPdfs] = useState<
    Array<{ id: string; filename: string; pagesCount: number; timestamp: number }>
  >([]);

  // Load saved PDFs metadata on mount
  useEffect(() => {
    chrome.storage.local.get(['savedPdfsMeta'], (result) => {
      setSavedPdfs(result.savedPdfsMeta || []);
    });
  }, []);

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

  const handlePdfFile = async (file: File | null) => {
    if (!file) return;
    setPdfFilename(file.name);
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: Array<{ page: number; text: string }> = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((it: any) => it.str || '').join(' ');
        pages.push({ page: i, text: strings });
      } catch (e) {
        console.error('Error extracting page', i, e);
      }
    }
    setPdfTextPages(pages);
  };

  const saveCurrentPdf = async () => {
    if (!pdfFilename || pdfTextPages.length === 0) return;
    const id = Date.now().toString();
    const pdfRecord = {
      id,
      filename: pdfFilename,
      pages: pdfTextPages.map((p) => ({ page: p.page, text: p.text })),
      timestamp: Date.now(),
    };

    try {
      // save full content in IndexedDB
      await savePdfRecord(pdfRecord);

      // store lightweight metadata in chrome.storage.local under 'savedPdfsMeta'
      chrome.storage.local.get(['savedPdfsMeta'], (res) => {
        const current = res.savedPdfsMeta || [];
        const meta = { id, filename: pdfFilename, pagesCount: pdfRecord.pages.length, timestamp: pdfRecord.timestamp };
        const updated = [...current, meta];
        chrome.storage.local.set({ savedPdfsMeta: updated }, () => {
          setSavedPdfs(updated);
        });
      });
    } catch (err) {
      console.error('Failed to save PDF to storage:', err);
    }
  };

  const removeSavedPdf = (pdfId: string) => {
    // delete from IndexedDB and update metadata
    deletePdfRecord(pdfId)
      .then(() => {
        chrome.storage.local.get(['savedPdfsMeta'], (result) => {
          const current = result.savedPdfsMeta || [];
          const updated = current.filter((p: any) => p.id !== pdfId);
          chrome.storage.local.set({ savedPdfsMeta: updated }, () => setSavedPdfs(updated));
        });
      })
      .catch((err) => console.error('Error removing PDF from storage:', err));
  };

  const handlePdfInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    handlePdfFile(f);
  };

  const savePdfSelection = async (pageText: string, selectedText: string) => {
    const selected = selectedText.trim();
    if (!selected) return;

    // Try to get the clipboard text first (in case the user copied a trimmed/normalized version)
    let fullText = pageText;
    try {
      const clip = await navigator.clipboard.readText();
      if (clip && clip.length > 0) {
        // prefer clipboard text when it contains the selected substring
        if (clip.includes(selected)) {
          fullText = clip;
        }
      }
    } catch (e) {
      // clipboard may be unavailable (permissions) - just ignore and use pageText
      // console.warn('Clipboard read failed or denied, using page text fallback', e);
    }

    const selectedStart = fullText.indexOf(selected);
    if (selectedStart === -1) {
      // if not found in clipboard nor in pageText, fall back to original pageText search
      const fallbackStart = pageText.indexOf(selected);
      if (fallbackStart === -1) return;
      fullText = pageText;
    }

    const startIdx = fullText.indexOf(selected);
    if (startIdx === -1) return;

    const beforeText = fullText.slice(0, startIdx);
    const afterText = fullText.slice(startIdx + selected.length);

    const beforeMatch = beforeText.match(/([.!?])[\s\n]*([^.!?]*)$/);
    const beforeBoundary = beforeMatch ? beforeText.lastIndexOf(beforeMatch[1]) + 1 : 0;

    const afterMatch = afterText.match(/([.!?])/);
    const afterBoundary = afterMatch ? startIdx + selected.length + (afterMatch.index ?? 0) + 1 : fullText.length;

    const sentence = fullText.slice(beforeBoundary, afterBoundary).trim();

    const sentenceSelectedStart = sentence.indexOf(selected);
    const beforeContext = sentence.slice(0, sentenceSelectedStart).trim();
    const afterContext = sentence.slice(sentenceSelectedStart + selected.length).trim();

    const savedItem: SavedTextItem = {
      id: Date.now().toString(),
      content: {
        before: beforeContext,
        selected,
        after: afterContext,
      },
      timestamp: Date.now(),
      fullText: `...${beforeContext} **${selected}** ${afterContext}...`,
    };

    chrome.storage.sync.get(['savedWords'], (result) => {
      const current = result.savedWords || [];
      const updated = [...current, savedItem];
      chrome.storage.sync.set({ savedWords: updated }, () => {
        setSavedWords(updated);
      });
    });
  };

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

  const handleClearAll = async () => {
    const confirmed = confirm('Clear all saved words and PDFs? This cannot be undone.');
    if (!confirmed) return;

    try {
      // Clear saved words in sync storage
      chrome.storage.sync.set({ savedWords: [] }, () => {
        setSavedWords([]);
      });

      // Remove saved PDFs metadata
      chrome.storage.local.remove(['savedPdfsMeta'], () => {
        setSavedPdfs([]);
      });

      // Delete all PDF records from IndexedDB
      try {
        const all = await getAllPdfRecords();
  const deletes = all.map((r: StoredPdfRecord) => deletePdfRecord(r.id));
        await Promise.all(deletes);
      } catch (err) {
        console.error('Error deleting PDF records from IndexedDB:', err);
      }

    } catch (err) {
      console.error('Failed to clear data:', err);
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
        <button
          className="clear-all-button"
          onClick={handleClearAll}
          title="Clear all saved words and PDFs"
          aria-label="Clear all saved words and PDFs"
        >
          Clear all
        </button>
      </div>
      <div className="pdf-import">
        <label className="pdf-import-label">Import PDF (local)</label>
        <input type="file" accept="application/pdf" onChange={handlePdfInputChange} />
        {pdfFilename && (
          <div className="pdf-filename-row">
            <div className="pdf-filename">Loaded: {pdfFilename}</div>
            <button className="save-pdf-button" onClick={saveCurrentPdf} type="button">Save PDF</button>
          </div>
        )}

        {pdfTextPages.length > 0 && (
          <div>
            <div className="pdf-page-nav">
              <label htmlFor="goto-page-input">Go to page:</label>
              <input
                id="goto-page-input"
                type="number"
                min={1}
                max={pdfTextPages.length}
                value={gotoPage as any}
                onChange={(e) => setGotoPage(e.target.value === '' ? '' : Number(e.target.value))}
              />
              <button
                onClick={() => {
                  if (!gotoPage) return;
                  const container = pdfPagesRef.current;
                  if (!container) return;
                  const child = container.querySelector(`.pdf-page[data-page="${gotoPage}"]`);
                  if (child) (child as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                type="button"
              >
                Go
              </button>
            </div>

            <div className="pdf-pages" ref={pdfPagesRef}>
              {pdfTextPages.map((p) => (
                <div key={p.page} className="pdf-page" data-page={p.page}>
                  <h4>Page {p.page}</h4>
                  <textarea
                    className="pdf-page-text"
                    defaultValue={p.text}
                    onDoubleClick={async (e) => {
                      const ta = e.target as HTMLTextAreaElement;
                      const selection = ta.value.substring(ta.selectionStart, ta.selectionEnd);
                      await savePdfSelection(p.text, selection);
                    }}
                  />
                  <p className="pdf-hint">Double-click a selection inside the text area to save it.</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {savedPdfs.length > 0 && (
          <div className="saved-pdfs">
            <h4>Saved PDFs</h4>
            {savedPdfs.map((p) => (
              <div key={p.id} className="saved-pdf-item">
                <div className="saved-pdf-meta">
                  <strong>{p.filename}</strong> <span className="small">({p.pagesCount} pages)</span>
                </div>
                <div className="saved-pdf-actions">
                  <button
                    onClick={async () => {
                      try {
                        const full = await getPdfRecord(p.id);
                        if (full) {
                          setPdfFilename(full.filename);
                          setPdfTextPages(full.pages.map((pg) => ({ page: pg.page, text: pg.text })));
                        }
                      } catch (err) {
                        console.error('Error loading saved PDF from storage:', err);
                      }
                    }}
                  >
                    Load
                  </button>
                  <button onClick={() => removeSavedPdf(p.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
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
