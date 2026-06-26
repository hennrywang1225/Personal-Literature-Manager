import { useEffect, useState } from 'react'
import type {
  AppSettings,
  CategoryRecord,
  CreatePdfAnnotationInput,
  DocumentRecord,
  ImportCandidate,
  ImportConfirmation,
  LibrarySnapshot,
  PdfAnnotationRecord,
} from '../shared/types'
import { libraryApi } from './api/client'
import { AppShell } from './components/AppShell'
import { ImportReviewDialog } from './components/ImportReviewDialog'
import { LibraryView } from './components/LibraryView'
import { ReaderView } from './components/ReaderView'
import { SettingsDialog } from './components/SettingsDialog'

type Mode = 'library' | 'reader'

interface ReaderFileUrlState {
  documentId: string
  url: string
}

interface ReaderFileUrlErrorState {
  documentId: string
  message: string
}

interface ReaderTextContentState {
  documentId: string
  content: string
}

interface ReaderTextContentErrorState {
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
  const [settings, setSettings] = useState<AppSettings>({
    libraryRoot: '',
    defaultExportDir: null,
  })
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  )
  const [mode, setMode] = useState<Mode>('library')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>(
    [],
  )
  const [importDefaultCategoryId, setImportDefaultCategoryId] = useState<
    string | null
  >(null)
  const [importSubmitError, setImportSubmitError] = useState<string | null>(null)
  const [readerFileUrl, setReaderFileUrl] =
    useState<ReaderFileUrlState | null>(null)
  const [readerFileUrlError, setReaderFileUrlError] =
    useState<ReaderFileUrlErrorState | null>(null)
  const [readerTextContent, setReaderTextContent] =
    useState<ReaderTextContentState | null>(null)
  const [readerTextContentError, setReaderTextContentError] =
    useState<ReaderTextContentErrorState | null>(null)
  const [readerPdfAnnotations, setReaderPdfAnnotations] = useState<
    Record<string, PdfAnnotationRecord[]>
  >({})

  const selectedDocument =
    snapshot.documents.find((document) => document.id === selectedDocumentId) ??
    null
  const selectedReaderFileUrl =
    readerFileUrl?.documentId === selectedDocumentId ? readerFileUrl.url : null
  const selectedReaderFileUrlError =
    readerFileUrlError?.documentId === selectedDocumentId
      ? readerFileUrlError.message
      : null
  const selectedReaderTextContent =
    readerTextContent?.documentId === selectedDocumentId
      ? readerTextContent.content
      : null
  const selectedReaderTextContentError =
    readerTextContentError?.documentId === selectedDocumentId
      ? readerTextContentError.message
      : null
  const selectedReaderPdfAnnotations = selectedDocumentId
    ? readerPdfAnnotations[selectedDocumentId] ?? []
    : []

  useEffect(() => {
    let isMounted = true

    async function loadSnapshot() {
      try {
        const [nextSettings, nextSnapshot] = await Promise.all([
          libraryApi.getSettings(),
          libraryApi.getSnapshot(),
        ])

        if (!isMounted) {
          return
        }

        setSettings(nextSettings)
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

    if (mode !== 'reader' || !selectedDocument) {
      setReaderFileUrl(null)
      setReaderFileUrlError(null)
      setReaderTextContent(null)
      setReaderTextContentError(null)
      return () => {
        isMounted = false
      }
    }

    setReaderFileUrl(null)
    setReaderFileUrlError(null)
    setReaderTextContent(null)
    setReaderTextContentError(null)

    if (selectedDocument.fileType !== 'pdf' && selectedDocument.fileType !== 'md') {
      return () => {
        isMounted = false
      }
    }

    async function loadReaderResource() {
      try {
        if (selectedDocument?.fileType === 'pdf') {
          const [fileUrl, annotations] = await Promise.all([
            libraryApi.getFileUrl(selectedDocument.id),
            libraryApi.listPdfAnnotations(selectedDocument.id),
          ])

          if (isMounted) {
            setReaderFileUrl({
              documentId: selectedDocument.id,
              url: fileUrl,
            })
            setReaderPdfAnnotations((currentAnnotations) => ({
              ...currentAnnotations,
              [selectedDocument.id]: annotations,
            }))
          }
          return
        }

        if (selectedDocument?.fileType === 'md') {
          const content = await libraryApi.getTextContent(selectedDocument.id)

          if (isMounted) {
            setReaderTextContent({
              content,
              documentId: selectedDocument.id,
            })
          }
        }
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof Error ? error.message : '无法加载文件预览'

          if (selectedDocument?.fileType === 'pdf') {
            setReaderFileUrl(null)
            setReaderFileUrlError({
              documentId: selectedDocument.id,
              message,
            })
          }

          if (selectedDocument?.fileType === 'md') {
            setReaderTextContent(null)
            setReaderTextContentError({
              documentId: selectedDocument.id,
              message,
            })
          }
        }
      }
    }

    void loadReaderResource()

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

  const handleBulkUpdateCategory = async (
    documentIds: string[],
    categoryId: string | null,
  ) => {
    try {
      const updatedDocuments = await libraryApi.updateDocumentsCategory(
        documentIds,
        categoryId,
      )

      setSnapshot((currentSnapshot) => ({
        ...currentSnapshot,
        documents: currentSnapshot.documents.map((document) => {
          const updated = updatedDocuments.find((item) => item.id === document.id)
          return updated ?? document
        }),
      }))
      setErrorMessage(null)
      setStatusMessage(`已移动 ${updatedDocuments.length} 篇文献。`)
    } catch (error) {
      setStatusMessage(null)
      setErrorMessage(error instanceof Error ? error.message : '批量移动分类失败')
    }
  }

  const handleCreateCategory = async (
    name: string,
    parentId: string | null,
  ): Promise<CategoryRecord> => {
    try {
      setErrorMessage(null)
      const category = await libraryApi.upsertCategory(name, parentId)
      const nextSnapshot = await libraryApi.getSnapshot()

      setSnapshot(nextSnapshot)
      setStatusMessage(
        parentId
          ? `已创建子分类：${category.name}`
          : `已创建分类：${category.name}`,
      )
      return category
    } catch (error) {
      setStatusMessage(null)
      setErrorMessage(error instanceof Error ? error.message : '创建分类失败')
      throw error
    }
  }

  const handleImport = async (defaultCategoryId: string | null = null) => {
    try {
      setErrorMessage(null)
      setImportSubmitError(null)
      const candidates = await libraryApi.chooseImportFiles()

      if (candidates.length === 0) {
        setImportDefaultCategoryId(null)
        setStatusMessage('已取消导入。')
        return
      }

      setStatusMessage(null)
      setImportDefaultCategoryId(defaultCategoryId)
      setImportCandidates(candidates)
    } catch (error) {
      setImportDefaultCategoryId(null)
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
      setImportDefaultCategoryId(null)
      setImportSubmitError(null)
      setStatusMessage(`已导入 ${importedDocuments.length} 篇文献。`)
    } catch (error) {
      setImportSubmitError(error instanceof Error ? error.message : '保存导入失败')
    }
  }

  const handleCancelImport = () => {
    setImportCandidates([])
    setImportDefaultCategoryId(null)
    setImportSubmitError(null)
    setStatusMessage('已取消导入。')
  }

  const showExportSuccess = (zipPath: string | null) => {
    if (!zipPath) {
      setErrorMessage(null)
      setStatusMessage('已取消导出。')
      return
    }

    setErrorMessage(null)
    setStatusMessage(`已导出：${zipPath}`)
  }

  const showExportError = (error: unknown) => {
    setStatusMessage(null)
    setErrorMessage(error instanceof Error ? error.message : '导出失败')
  }

  const handleExportSelection = async (documentIds: string[]) => {
    if (documentIds.length === 0) {
      return
    }

    try {
      setErrorMessage(null)
      const zipPath = await libraryApi.exportSelection(documentIds)

      showExportSuccess(zipPath)
    } catch (error) {
      showExportError(error)
    }
  }

  const handleExportCategory = async (categoryId: string | null) => {
    if (!categoryId) {
      return
    }

    try {
      setErrorMessage(null)
      const zipPath = await libraryApi.exportCategory(categoryId)

      showExportSuccess(zipPath)
    } catch (error) {
      showExportError(error)
    }
  }

  const handleExportAll = async () => {
    try {
      setErrorMessage(null)
      const zipPath = await libraryApi.exportAll()

      showExportSuccess(zipPath)
    } catch (error) {
      showExportError(error)
    }
  }

  const handleDeleteDocuments = async (documentIds: string[]) => {
    const uniqueDocumentIds = [...new Set(documentIds)]

    if (uniqueDocumentIds.length === 0) {
      return
    }

    const confirmed = window.confirm(
      `确定删除选中的 ${uniqueDocumentIds.length} 篇文献吗？此操作会从文献库移除记录和已导入文件。`,
    )

    if (!confirmed) {
      return
    }

    try {
      setErrorMessage(null)
      const deletedDocuments = await libraryApi.deleteDocuments(uniqueDocumentIds)
      const deletedIds = new Set(
        deletedDocuments.length > 0
          ? deletedDocuments.map((document) => document.id)
          : uniqueDocumentIds,
      )

      setSnapshot((currentSnapshot) => {
        const documents = currentSnapshot.documents.filter(
          (document) => !deletedIds.has(document.id),
        )

        setSelectedDocumentId((currentSelectedDocumentId) =>
          currentSelectedDocumentId && deletedIds.has(currentSelectedDocumentId)
            ? documents[0]?.id ?? null
            : currentSelectedDocumentId,
        )

        return {
          ...currentSnapshot,
          documents,
        }
      })

      if (selectedDocumentId && deletedIds.has(selectedDocumentId)) {
        setMode('library')
      }

      setStatusMessage(`已删除 ${deletedIds.size} 篇文献。`)
    } catch (error) {
      setStatusMessage(null)
      setErrorMessage(error instanceof Error ? error.message : '删除文献失败')
    }
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

  const handleCreatePdfAnnotation = async (input: CreatePdfAnnotationInput) => {
    try {
      const annotation = await libraryApi.createPdfAnnotation(input)

      setReaderPdfAnnotations((currentAnnotations) => ({
        ...currentAnnotations,
        [annotation.documentId]: [
          ...(currentAnnotations[annotation.documentId] ?? []),
          annotation,
        ],
      }))
      setErrorMessage(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存 PDF 标注失败'
      setErrorMessage(message)
      throw error
    }
  }

  const handleDeletePdfAnnotation = async (annotationId: string) => {
    try {
      const deletedAnnotation = await libraryApi.deletePdfAnnotation(annotationId)

      setReaderPdfAnnotations((currentAnnotations) => ({
        ...currentAnnotations,
        [deletedAnnotation.documentId]: (
          currentAnnotations[deletedAnnotation.documentId] ?? []
        ).filter((annotation) => annotation.id !== deletedAnnotation.id),
      }))
      setErrorMessage(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除 PDF 标注失败'
      setErrorMessage(message)
      throw error
    }
  }

  const handleChooseLibraryRoot = async () => {
    try {
      setErrorMessage(null)
      const nextSettings = await libraryApi.chooseLibraryRoot()
      const nextSnapshot = await libraryApi.getSnapshot()

      setSettings(nextSettings)
      setSnapshot(nextSnapshot)
      setSelectedDocumentId(nextSnapshot.documents[0]?.id ?? null)
      setStatusMessage(`文献库位置已更新：${nextSettings.libraryRoot}`)
    } catch (error) {
      setStatusMessage(null)
      setErrorMessage(error instanceof Error ? error.message : '更改文献库位置失败')
    }
  }

  const handleChooseDefaultExportDirectory = async () => {
    try {
      setErrorMessage(null)
      const nextSettings = await libraryApi.chooseDefaultExportDirectory()

      setSettings(nextSettings)
      setStatusMessage(`默认导出位置已更新：${nextSettings.defaultExportDir}`)
    } catch (error) {
      setStatusMessage(null)
      setErrorMessage(error instanceof Error ? error.message : '更改导出位置失败')
    }
  }

  return (
    <AppShell
      mode={mode}
      onModeChange={setMode}
      onOpenSettings={() => setIsSettingsOpen(true)}
    >
      <div className="workspace-stack">
        {errorMessage ? <p className="status-message">{errorMessage}</p> : null}
        {statusMessage ? <p className="status-message">{statusMessage}</p> : null}
        {isLoading ? <p className="status-message">正在载入资料库...</p> : null}
        {!isLoading && mode === 'library' ? (
          <LibraryView
            onBulkUpdateCategory={handleBulkUpdateCategory}
            onCreateCategory={handleCreateCategory}
            onDeleteDocuments={handleDeleteDocuments}
            onExportAll={handleExportAll}
            onExportCategory={handleExportCategory}
            onExportSelection={handleExportSelection}
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
            defaultCategoryId={importDefaultCategoryId}
            onCancel={handleCancelImport}
            onConfirm={handleConfirmImport}
            submitError={importSubmitError}
          />
        ) : null}
        {isSettingsOpen ? (
          <SettingsDialog
            onChooseDefaultExportDirectory={handleChooseDefaultExportDirectory}
            onChooseLibraryRoot={handleChooseLibraryRoot}
            onClose={() => setIsSettingsOpen(false)}
            settings={settings}
          />
        ) : null}
        {!isLoading && mode === 'reader' ? (
          <ReaderView
            fileUrl={selectedReaderFileUrl}
            fileUrlError={selectedReaderFileUrlError}
            markdownContent={selectedReaderTextContent}
            markdownContentError={selectedReaderTextContentError}
            onBackToLibrary={() => setMode('library')}
            onCreatePdfAnnotation={handleCreatePdfAnnotation}
            onDeletePdfAnnotation={handleDeletePdfAnnotation}
            onOpenExternal={handleOpenExternal}
            onSelectDocument={setSelectedDocumentId}
            onUpdateDocument={handleUpdateDocument}
            pdfAnnotations={selectedReaderPdfAnnotations}
            selectedDocumentId={selectedDocumentId}
            snapshot={snapshot}
          />
        ) : null}
      </div>
    </AppShell>
  )
}
