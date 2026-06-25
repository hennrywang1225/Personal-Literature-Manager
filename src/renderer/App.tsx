import { useEffect, useState } from 'react'
import type {
  DocumentRecord,
  ImportCandidate,
  ImportConfirmation,
  LibrarySnapshot,
} from '../shared/types'
import { libraryApi } from './api/client'
import { AppShell } from './components/AppShell'
import { ImportReviewDialog } from './components/ImportReviewDialog'
import { LibraryView } from './components/LibraryView'
import { ReaderView } from './components/ReaderView'

type Mode = 'library' | 'reader'

interface ReaderFileUrlState {
  documentId: string
  url: string
}

interface ReaderFileUrlErrorState {
  documentId: string
  message: string
}

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
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>(
    [],
  )
  const [importSubmitError, setImportSubmitError] = useState<string | null>(null)
  const [readerFileUrl, setReaderFileUrl] =
    useState<ReaderFileUrlState | null>(null)
  const [readerFileUrlError, setReaderFileUrlError] =
    useState<ReaderFileUrlErrorState | null>(null)

  const selectedDocument =
    snapshot.documents.find((document) => document.id === selectedDocumentId) ??
    null
  const selectedReaderFileUrl =
    readerFileUrl?.documentId === selectedDocumentId ? readerFileUrl.url : null
  const selectedReaderFileUrlError =
    readerFileUrlError?.documentId === selectedDocumentId
      ? readerFileUrlError.message
      : null

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

  useEffect(() => {
    let isMounted = true

    if (
      mode !== 'reader' ||
      !selectedDocument ||
      selectedDocument.fileType !== 'pdf'
    ) {
      setReaderFileUrl(null)
      setReaderFileUrlError(null)
      return () => {
        isMounted = false
      }
    }

    setReaderFileUrl(null)
    setReaderFileUrlError(null)

    async function loadReaderFileUrl() {
      try {
        const fileUrl = await libraryApi.getFileUrl(selectedDocument.id)

        if (isMounted) {
          setReaderFileUrl({
            documentId: selectedDocument.id,
            url: fileUrl,
          })
        }
      } catch (error) {
        if (isMounted) {
          setReaderFileUrl(null)
          setReaderFileUrlError({
            documentId: selectedDocument.id,
            message:
              error instanceof Error ? error.message : '无法加载文件预览',
          })
        }
      }
    }

    void loadReaderFileUrl()

    return () => {
      isMounted = false
    }
  }, [mode, selectedDocument?.fileType, selectedDocument?.id])

  const handleUpdateDocument = async (
    documentId: string,
    patch: DocumentPatch,
  ) => {
    try {
      const updatedDocument = await libraryApi.updateDocument(documentId, patch)

      setSnapshot((currentSnapshot) => ({
        ...currentSnapshot,
        documents: currentSnapshot.documents.map((document) =>
          document.id === documentId ? updatedDocument : document,
        ),
      }))
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '保存修改失败')
    }
  }

  const handleImport = async () => {
    try {
      setErrorMessage(null)
      setImportSubmitError(null)
      const candidates = await libraryApi.chooseImportFiles()

      if (candidates.length === 0) {
        setStatusMessage('已取消导入。')
        return
      }

      setStatusMessage(null)
      setImportCandidates(candidates)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '导入失败')
    }
  }

  const handleConfirmImport = async (confirmations: ImportConfirmation[]) => {
    try {
      setErrorMessage(null)
      setImportSubmitError(null)
      const importedDocuments = await libraryApi.confirmImports(confirmations)
      const nextSnapshot = await libraryApi.getSnapshot()

      setSnapshot(nextSnapshot)
      setSelectedDocumentId(
        importedDocuments[0]?.id ?? nextSnapshot.documents[0]?.id ?? null,
      )
      setImportCandidates([])
      setImportSubmitError(null)
      setStatusMessage(`已导入 ${importedDocuments.length} 篇文献。`)
    } catch (error) {
      setImportSubmitError(error instanceof Error ? error.message : '保存导入失败')
    }
  }

  const handleCancelImport = () => {
    setImportCandidates([])
    setImportSubmitError(null)
    setStatusMessage('已取消导入。')
  }

  const handleExportAll = async () => {
    await libraryApi.exportAll()
  }

  const handleOpenExternal = async (documentId: string) => {
    try {
      setErrorMessage(null)
      const message = await libraryApi.openExternal(documentId)

      if (message) {
        setErrorMessage(message)
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '外部打开失败')
    }
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
      {importCandidates.length > 0 ? (
        <ImportReviewDialog
          candidates={importCandidates}
          onCancel={handleCancelImport}
          onConfirm={handleConfirmImport}
          submitError={importSubmitError}
        />
      ) : null}
      {!isLoading && mode === 'reader' ? (
        <ReaderView
          fileUrl={selectedReaderFileUrl}
          fileUrlError={selectedReaderFileUrlError}
          onBackToLibrary={() => setMode('library')}
          onOpenExternal={handleOpenExternal}
          onSelectDocument={setSelectedDocumentId}
          onUpdateDocument={handleUpdateDocument}
          selectedDocumentId={selectedDocumentId}
          snapshot={snapshot}
        />
      ) : null}
    </AppShell>
  )
}
