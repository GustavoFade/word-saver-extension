export interface StoredPdfRecord {
  id: string;
  filename: string;
  pages: Array<{ page: number; text: string }>;
  timestamp: number;
}

const DATABASE_NAME = 'wordSaverDB';
const PDF_STORE_NAME = 'pdfs';
const DATABASE_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    openRequest.onupgradeneeded = () => {
      const db = openRequest.result;
      if (!db.objectStoreNames.contains(PDF_STORE_NAME)) {
        db.createObjectStore(PDF_STORE_NAME, { keyPath: 'id' });
      }
    };

    openRequest.onsuccess = () => resolve(openRequest.result);
    openRequest.onerror = () => reject(openRequest.error);
  });
}

function requestToPromise<T = unknown>(request: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
  });
}

export async function savePdfRecord(record: StoredPdfRecord): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(PDF_STORE_NAME, 'readwrite');
  const objectStore = transaction.objectStore(PDF_STORE_NAME);
  await requestToPromise(objectStore.put(record));
}

export async function getPdfRecord(id: string): Promise<StoredPdfRecord | null> {
  const db = await openDatabase();
  const transaction = db.transaction(PDF_STORE_NAME, 'readonly');
  const objectStore = transaction.objectStore(PDF_STORE_NAME);
  const result = await requestToPromise<StoredPdfRecord | undefined>(objectStore.get(id));
  return result || null;
}

export async function deletePdfRecord(id: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(PDF_STORE_NAME, 'readwrite');
  const objectStore = transaction.objectStore(PDF_STORE_NAME);
  await requestToPromise(objectStore.delete(id));
}

export async function getAllPdfRecords(): Promise<StoredPdfRecord[]> {
  const db = await openDatabase();
  const transaction = db.transaction(PDF_STORE_NAME, 'readonly');
  const objectStore = transaction.objectStore(PDF_STORE_NAME);
  const result = await requestToPromise<StoredPdfRecord[]>(objectStore.getAll());
  return result || [];
}
