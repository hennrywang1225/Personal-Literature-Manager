# PDF Annotations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add software-local PDF highlight and underline annotations in reader mode without modifying the original PDF file.

**Architecture:** Store annotation rectangles in SQLite as normalized page coordinates and expose them through the existing Electron preload API. Replace the iframe PDF preview with a React/pdf.js viewer that renders canvas pages, transparent text spans for selection, and an annotation overlay.

**Tech Stack:** Electron, React, TypeScript, sql.js, pdfjs-dist, Vitest, Testing Library.

---

### Task 1: Annotation Data Model

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/database.ts`
- Modify: `src/main/documentRepository.ts`
- Test: `src/main/database.test.ts`
- Test: `src/main/documentRepository.test.ts`

- [ ] Add `PdfAnnotationType`, `PdfAnnotationRect`, `PdfAnnotationRecord`, and `CreatePdfAnnotationInput`.
- [ ] Add a `pdf_annotations` table with `document_id`, `page_number`, `type`, `color`, `rects_json`, and timestamps.
- [ ] Add repository methods `listPdfAnnotations(documentId)`, `createPdfAnnotation(input)`, and `deletePdfAnnotation(id)`.
- [ ] Tests must prove annotations are persisted, listed by document/page order, and cascade/delete with documents.

### Task 2: IPC And Client API

**Files:**
- Modify: `src/main/ipcHandlers.ts`
- Modify: `src/main/ipcHandlers.test.ts`
- Modify: `src/main/preload.ts`
- Modify: `src/renderer/api/client.ts`
- Modify: `src/renderer/api/client.test.ts`

- [ ] Add `library:listPdfAnnotations`, `library:createPdfAnnotation`, and `library:deletePdfAnnotation`.
- [ ] Validate annotation payloads: document id string, page number >= 1, type is `highlight` or `underline`, color string, rects array with finite normalized numbers.
- [ ] Save the database after create/delete.
- [ ] Tests must fail before implementation and pass after handlers are wired.

### Task 3: PDF Viewer Component

**Files:**
- Create: `src/renderer/components/PdfAnnotationViewer.tsx`
- Create: `src/renderer/components/PdfAnnotationViewer.test.tsx`
- Modify: `src/renderer/styles.css`

- [ ] Render a PDF with `pdfjs-dist` using `getDocument(fileUrl)` and page canvases.
- [ ] Render text spans on top of each page so browser selection works.
- [ ] Add toolbar modes: select, highlight, underline; highlight colors: yellow, green, blue.
- [ ] When text is selected and a mark tool is clicked, compute normalized rects relative to the page and call `onCreateAnnotation`.
- [ ] Render saved annotations as overlay rectangles; underline uses a thin bottom border.
- [ ] Allow deleting an annotation by selecting/clicking it and pressing a delete button.

### Task 4: Reader Integration

**Files:**
- Modify: `src/renderer/components/ReaderView.tsx`
- Modify: `src/renderer/components/ReaderView.test.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/App.test.tsx`

- [ ] Replace the PDF iframe with `PdfAnnotationViewer` for PDF files.
- [ ] Load annotations when a PDF document enters reader mode.
- [ ] Create/delete annotations through the new API and update local state.
- [ ] Keep Markdown and external-open behavior unchanged.

### Task 5: Verification And Package

**Files:**
- No direct source edits.

- [ ] Run targeted tests for repository, IPC, client, ReaderView, PdfAnnotationViewer, and App.
- [ ] Run `npm run build`.
- [ ] Run `npm run dist:win`.
- [ ] Confirm both release EXEs have fresh timestamps.
