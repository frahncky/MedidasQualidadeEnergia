import { DATA_SOURCE_CATALOG } from './referenceDatasets'

const DB_NAME = 'smqe_dataset_registry'
const DB_VERSION = 1
const CATALOG_STORE = 'catalog'
const IMPORTS_STORE = 'imports'

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined'
}

function toPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Falha no IndexedDB'))
  })
}

function openRegistryDb() {
  if (!hasIndexedDb()) return Promise.reject(new Error('IndexedDB indisponível'))

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(CATALOG_STORE)) {
        db.createObjectStore(CATALOG_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(IMPORTS_STORE)) {
        const imports = db.createObjectStore(IMPORTS_STORE, { keyPath: 'id' })
        imports.createIndex('sourceId', 'sourceId', { unique: false })
        imports.createIndex('savedAt', 'savedAt', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Falha ao abrir banco local'))
  })
}

async function withStore(storeName, mode, operation) {
  const db = await openRegistryDb()
  try {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    const result = await operation(store)
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error ?? new Error('Falha na transação'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Transação abortada'))
    })
    return result
  } finally {
    db.close()
  }
}

export async function seedDatasetRegistry(catalog = DATA_SOURCE_CATALOG) {
  if (!hasIndexedDb()) return catalog
  const seededAt = new Date().toISOString()
  await withStore(CATALOG_STORE, 'readwrite', async store => {
    await Promise.all(catalog.map(source => toPromise(store.put({ ...source, seededAt }))))
  })
  return listDatasetCatalog()
}

export async function listDatasetCatalog() {
  if (!hasIndexedDb()) return DATA_SOURCE_CATALOG
  const rows = await withStore(CATALOG_STORE, 'readonly', store => toPromise(store.getAll()))
  return rows?.length ? rows : DATA_SOURCE_CATALOG
}

export async function listImportedDatasetRecords() {
  if (!hasIndexedDb()) return []
  const rows = await withStore(IMPORTS_STORE, 'readonly', store => toPromise(store.getAll()))
  return rows.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))
}

export async function getLatestImportForSource(sourceId) {
  if (!hasIndexedDb() || !sourceId) return null
  const records = await listImportedDatasetRecords()
  return records.find(record => record.sourceId === sourceId) ?? null
}

export async function loadImportedDataset(recordId) {
  if (!hasIndexedDb() || !recordId) return null
  const record = await withStore(IMPORTS_STORE, 'readonly', store => toPromise(store.get(recordId)))
  return record?.dataset ?? null
}

export async function saveImportedDatasetRecord({ source, dataset, format }) {
  if (!hasIndexedDb() || !dataset?.rows?.length) return null

  const savedAt = new Date().toISOString()
  const record = {
    id: `${source?.id ?? 'arquivo'}:${Date.now()}`,
    sourceId: source?.id ?? null,
    sourceName: source?.name ?? dataset.sourceReference ?? dataset.fileName,
    sourceLineage: source?.lineage ?? dataset.sourceLineage ?? 'Arquivo importado',
    sourceCitation: source?.citation ?? dataset.sourceCitation ?? '',
    sourceUrl: source?.url ?? dataset.sourceUrl ?? '',
    sourceDownloadUrl: source?.downloadUrl ?? dataset.sourceDownloadUrl ?? dataset.downloadUrl ?? '',
    format: format ?? dataset.sourceFormat ?? dataset.delimiter ?? '',
    fileName: dataset.fileName,
    sourceType: dataset.sourceType,
    totalRows: dataset.totalRows ?? dataset.rows.length,
    columns: dataset.columns ?? Object.keys(dataset.rows[0] ?? {}),
    savedAt,
    dataset: {
      ...dataset,
      storedAt: savedAt,
    },
  }

  await withStore(IMPORTS_STORE, 'readwrite', store => toPromise(store.put(record)))
  return record
}
