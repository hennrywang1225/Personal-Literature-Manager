import { useEffect, useState } from 'react'
import type { DocumentRecord, LibrarySnapshot } from '../shared/types'
import { libraryApi } from './api/client'
import { AppShell } from './components/AppShell'
import { LibraryView } from './components/LibraryView'

type Mode = 'library' | 'reader'

type DocumentPatch = Partial<
  Pick<
    DocumentRecord,
    | 'title'
    | 'authors'
    | 'year'
    | 'doi'
    | 'venue'
    | 'categoryId'
    | 'tags'
    | 'importance'
    | 'readingStatus'
    | 'note'
  >
>

export function App(): JSX.Element {
  const [snapshot, setSnapshot] = useState<LibrarySnapshot>({
    documents: [],
    categories: [],
    tags: [],
  })
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  )
  const [mode, setMode] = useState<Mode>('library')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadSnapshot() {
      try {
        const nextSnapshot = await libraryApi.getSnapshot()

        if (!isMounted) {
          return
        }

        setSnapshot(nextSnapshot)
        setSelectedDocumentId(nextSnapshot.documents[0]?.id ?? null)
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : '载入失败')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadSnapshot()

    return () => {
      isMounted = false
    }
  }, [])

  const handleUpdateDocument = async (
    documentId: string,
    patch: DocumentPatch,
  ) => {
    const updatedDocument = await libraryApi.updateDocument(documentId, patch)

    setSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      documents: currentSnapshot.documents.map((document) =>
        document.id === documentId ? updatedDocument : document,
      ),
    }))
  }

  const handleImport = () => {
    setStatusMessage('导入确认窗口将在下一步实现。')
  }

  const handleExportAll = async () => {
    await libraryApi.exportAll()
  }

  return (
    <AppShell mode={mode} onModeChange={setMode}>
      {errorMessage ? <p className="status-message">{errorMessage}</p> : null}
      {statusMessage ? <p className="status-message">{statusMessage}</p> : null}
      {isLoading ? <p className="status-message">正在载入资料库...</p> : null}
      {!isLoading && mode === 'library' ? (
        <LibraryView
          onExportAll={handleExportAll}
          onImport={handleImport}
          onOpenReader={(documentId) => {
            setSelectedDocumentId(documentId)
            setMode('reader')
          }}
          onSelectDocument={setSelectedDocumentId}
          onUpdateDocument={handleUpdateDocument}
          selectedDocumentId={selectedDocumentId}
          snapshot={snapshot}
        />
      ) : null}
      {!isLoading && mode === 'reader' ? (
        <section className="reader-placeholder">
          <h2>阅读模式</h2>
          <p>阅读视图将在后续任务中接入。</p>
        </section>
      ) : null}
    </AppShell>
  )
}
