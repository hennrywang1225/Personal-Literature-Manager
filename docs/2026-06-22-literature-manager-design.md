# Personal Literature Manager Design

## Overview

Build a personal Windows literature manager for collecting, organizing, browsing, reading, and backing up research files. The first version focuses on reliable local document management rather than AI features.

The app should be usable by the owner and by other Windows users through packaged executables. It should not require Node.js, a database server, or developer tools on the target computer.

## Goals

- Import and manage PDF, Word, TXT, and Markdown files.
- Copy imported files into the app's own library storage so the original file can be moved or deleted.
- Provide a clear two-mode interface:
  - Library mode for organizing, filtering, searching, and batch management.
  - Reader mode for viewing PDFs and editing notes and metadata.
- Support categories, tags, reading status, and 1-5 star importance.
- Automatically extract basic metadata from PDFs during import when possible.
- Export selected papers or categories as backup packages.
- Package the app as both a Windows installer and a portable Windows build.
- Leave clear extension points for future AI translation, summarization, and analysis.

## Non-Goals For Version 1

- User accounts, cloud sync, and collaboration.
- AI translation, summary, analysis, or chat.
- OCR for scanned image-only PDFs.
- Full in-app preview for Word documents.
- Online bibliography database lookup.
- Citation formatting or reference manager integrations such as BibTeX, EndNote, or Zotero sync.

## Target Platform

Version 1 targets Windows desktop users.

The app should be delivered in two forms:

- Installer EXE: suitable for long-term personal use on one machine.
- Portable build: suitable for copying to another computer or USB drive.

The application data is stored locally. Installed builds use `%APPDATA%/Personal Literature Manager/Library` by default. Portable builds use a `LiteratureLibrary` directory beside the portable executable directory by default. The user can change the library location from settings after version 1 if needed.

## Technology Choice

Use Electron with React, SQLite, and PDF.js.

- Electron provides a straightforward path to Windows installer and portable executable packaging.
- React supports a modern two-mode interface and future AI panels.
- SQLite stores metadata locally without a separate database service.
- PDF.js provides in-app PDF preview.
- electron-builder creates installer and portable packages.

## User Experience

### Primary Navigation

The app has two primary modes:

- Library
- Reader

The user can switch between modes through top-level tabs or a persistent navigation control.

### Library Mode

Library mode is optimized for managing many documents.

Layout:

- Left sidebar: categories and quick filters.
- Center: searchable, sortable document table.
- Right details panel: selected document metadata and quick actions.

Core controls:

- Import documents.
- Search title, author, tags, category, notes, and DOI.
- Filter by category, tag, file type, reading status, and importance.
- Sort by title, author, year, import time, update time, status, or importance.
- Edit title, author, year, DOI, category, tags, status, importance, and notes.
- Open Reader mode for a selected PDF.
- Open non-PDF files with the system default application.
- Export selected documents or current category as a backup package.

### Reader Mode

Reader mode is optimized for reading one PDF while editing metadata and notes.

Layout:

- Left sidebar: current filtered paper list or category list.
- Center: PDF preview.
- Right details panel: metadata, tags, importance, status, notes, and future AI area.

Core controls:

- Navigate previous and next document in the current list.
- View PDF pages.
- Edit tags, category, importance, status, and notes while reading.
- Return to Library mode.

Word, TXT, and Markdown files can be selected from the library, but version 1 opens them with the system default application instead of previewing them inside the app. PDF is the only file type with built-in preview in version 1.

## Import Flow

When the user imports files, the app should:

1. Accept PDF, DOC, DOCX, TXT, MD, and Markdown files.
2. Copy each file into the app library's managed `files` directory.
3. Create a database record for each imported file.
4. For PDFs, attempt metadata extraction.
5. Show an import confirmation screen where the user can review and edit detected metadata before saving.

### PDF Metadata Extraction

Version 1 should attempt automatic extraction for:

- Title
- Author
- Year
- DOI
- Journal or venue when reasonably detectable

Extraction order:

1. PDF embedded metadata.
2. First-page text patterns.
3. File name fallback.

The extracted values are suggestions, not final truth. The user must be able to edit them before or after import.

If the PDF is image-only or extraction fails, the app should create the record with the file name as the title and leave other fields blank.

OCR is out of scope for version 1.

## Data Model

Use SQLite for local metadata.

Entities:

- documents
- categories
- tags
- document_tags
- app_settings

`documents` fields:

- id
- title
- authors
- year
- doi
- venue
- file_type
- original_file_name
- stored_file_name
- stored_file_path
- category_id
- importance
- reading_status
- note
- created_at
- updated_at
- last_opened_at

`categories` fields:

- id
- name
- parent_id
- sort_order
- created_at
- updated_at

`tags` fields:

- id
- name
- color
- created_at
- updated_at

Reading status values:

- To Read
- Reading
- Read
- Intensive

Importance values:

- 1
- 2
- 3
- 4
- 5

## Library Storage

A library directory contains the database, managed files, and exports.

Example structure:

```text
LiteratureLibrary/
  library.db
  files/
    document-id-1.pdf
    document-id-2.docx
  exports/
    backup-2026-06-22.zip
```

The implementation should avoid depending on the original imported file path after import. The managed copy is the source of truth.

## Backup And Export

Version 1 supports exporting:

- Selected documents.
- All documents in a category.
- All documents in the library.

Export package contents:

- Document files.
- Metadata JSON.
- Notes, tags, category, importance, status, DOI, and other stored fields.

The app should create a zip archive that can be stored elsewhere or shared.

Importing backup packages is out of scope for version 1, but the exported data format must include enough metadata to support future restore functionality.

## Error Handling

Import errors:

- If a file cannot be copied, show the file name and reason.
- If metadata extraction fails, still import the file using the file name as title.
- If a duplicate file is imported, warn the user and allow skip or import as a separate record.

Reader errors:

- If a managed file is missing, show a clear missing-file state and allow locating the file manually in a future version.
- If PDF preview fails, allow opening with the system default application.

Export errors:

- If a file is missing or locked, show which document failed.
- Do not create a misleading successful backup if required files were skipped.

## Testing And Verification

Version 1 should be tested with:

- Fresh empty library.
- Multiple PDF imports.
- PDFs with good embedded metadata.
- PDFs with bad or missing embedded metadata.
- Image-only PDF fallback behavior.
- Word, TXT, and Markdown imports.
- Category, tag, status, and importance editing.
- Search and filtering.
- PDF preview.
- Export selected documents.
- Export a category.
- Installer build on Windows.
- Portable build on Windows.
- Running the packaged app on a clean Windows machine without developer tools.

## Future Extensions

The first version should leave UI and architecture room for:

- AI translation.
- AI summary.
- AI question answering over the current paper.
- OCR for scanned PDFs.
- Bibliography lookup by DOI.
- Backup package import and full library restore.
- Citation export.
- Cloud sync.
