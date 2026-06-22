# Literature Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows desktop literature manager that imports research files, stores them in a local managed library, supports categories/tags/status/stars/notes, previews PDFs, exports backup packages, and produces installer plus portable builds.

**Architecture:** Electron main process owns trusted filesystem, SQLite, metadata extraction, exporting, and OS file opening. The preload exposes a typed API to a React renderer. The renderer implements the two-mode Library/Reader interface and never reads local files directly except through main-process APIs.

**Tech Stack:** Electron, electron-vite, React, TypeScript, sql.js, pdfjs-dist, adm-zip, Vitest, React Testing Library, electron-builder, lucide-react.

---

## Scope Check

This plan implements one vertical product: a local Windows literature manager. The work is split into sequential tasks that each leave the app in a testable state. AI features, OCR, cloud sync, citation export, and backup import are excluded from this implementation plan.

## File Structure

- `package.json`: scripts, dependencies, and electron-builder entry points.
- `electron.vite.config.ts`: main/preload/renderer bundling configuration.
- `electron-builder.yml`: Windows installer and portable build configuration.
- `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`: TypeScript project settings.
- `index.html`: renderer entry document.
- `src/shared/types.ts`: shared domain types used by main, preload, renderer, and tests.
- `src/shared/constants.ts`: allowed file types, statuses, importance range, and defaults.
- `src/shared/documentFilters.ts`: pure search/filter/sort helpers.
- `src/main/main.ts`: Electron app bootstrap and BrowserWindow creation.
- `src/main/preload.ts`: contextBridge API exposed to the renderer.
- `src/main/ipcHandlers.ts`: all IPC registration in one file.
- `src/main/libraryPaths.ts`: installed and portable library path resolution.
- `src/main/database.ts`: sql.js initialization, schema creation, persistence, and transactions.
- `src/main/documentRepository.ts`: document/category/tag CRUD over SQLite.
- `src/main/fileStore.ts`: managed file copy, duplicate checks, file URL generation, and external opening.
- `src/main/pdfMetadata.ts`: PDF embedded metadata plus first-page text extraction.
- `src/main/importService.ts`: import candidate creation and confirmed import persistence.
- `src/main/exportService.ts`: zip backup creation with metadata JSON and document files.
- `src/renderer/main.tsx`: React entry.
- `src/renderer/App.tsx`: top-level state, navigation, and selected-document coordination.
- `src/renderer/api/client.ts`: renderer wrapper around `window.literature`.
- `src/renderer/components/AppShell.tsx`: two-mode layout container.
- `src/renderer/components/LibraryView.tsx`: category sidebar, toolbar, table, details panel.
- `src/renderer/components/ReaderView.tsx`: filtered list, PDF frame, metadata and notes panel.
- `src/renderer/components/ImportReviewDialog.tsx`: detected metadata review before saving.
- `src/renderer/components/Stars.tsx`: 1-5 importance control.
- `src/renderer/components/TagEditor.tsx`: tag editor control.
- `src/renderer/styles.css`: application styling.
- `tests/fixtures/`: small text fixtures and generated binary fixtures for unit tests.
- `src/shared/*.test.ts`, `src/main/*.test.ts`, `src/renderer/**/*.test.tsx`: unit and component tests.

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `electron.vite.config.ts`
- Create: `electron-builder.yml`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `tsconfig.web.json`
- Create: `index.html`
- Create: `src/main/main.ts`
- Create: `src/main/preload.ts`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/styles.css`

- [ ] **Step 1: Create package configuration**

Create `package.json` with these scripts and dependency groups:

```json
{
  "name": "personal-literature-manager",
  "version": "0.1.0",
  "description": "Personal Windows literature manager",
  "main": "dist/main/main.js",
  "type": "module",
  "scripts": {
    "dev": "electron-vite dev",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "npm run typecheck && npm run test && electron-vite build",
    "dist:win": "npm run build && electron-builder --win nsis portable",
    "lint:deps": "npm ls --depth=0"
  },
  "dependencies": {
    "adm-zip": "^0.5.16",
    "lucide-react": "^0.468.0",
    "pdfjs-dist": "^4.10.38",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "sql.js": "^1.12.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/adm-zip": "^0.5.7",
    "@types/node": "^22.10.2",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "electron": "^33.2.1",
    "electron-builder": "^25.1.8",
    "electron-vite": "^2.3.0",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vite": "^5.4.11",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: exits with code 0 and creates `package-lock.json`.

- [ ] **Step 3: Create electron-vite configuration**

Create `electron.vite.config.ts`:

```ts
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { "@shared": resolve("src/shared") } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { "@shared": resolve("src/shared") } }
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
        "@renderer": resolve("src/renderer")
      }
    }
  }
});
```

- [ ] **Step 4: Create TypeScript configs**

Create `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node", "vitest/globals"],
    "baseUrl": ".",
    "paths": { "@shared/*": ["src/shared/*"] }
  },
  "include": ["src/main/**/*.ts", "src/shared/**/*.ts", "src/**/*.test.ts"]
}
```

Create `tsconfig.web.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"],
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@renderer/*": ["src/renderer/*"]
    }
  },
  "include": ["src/renderer/**/*.ts", "src/renderer/**/*.tsx", "src/shared/**/*.ts"]
}
```

- [ ] **Step 5: Create minimal app entry files**

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Personal Literature Manager</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/renderer/main.tsx"></script>
  </body>
</html>
```

Create `src/main/main.ts`:

```ts
import { app, BrowserWindow } from "electron";
import { join } from "node:path";

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1050,
    minHeight: 720,
    title: "Personal Literature Manager",
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

Create `src/main/preload.ts`:

```ts
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("literature", {
  version: "0.1.0"
});
```

Create `src/renderer/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `src/renderer/App.tsx`:

```tsx
export function App(): JSX.Element {
  return (
    <main className="app-placeholder">
      <h1>个人文献管理器</h1>
      <p>项目骨架已启动。</p>
    </main>
  );
}
```

Create `src/renderer/styles.css`:

```css
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Microsoft YaHei", "Segoe UI", Arial, sans-serif;
  color: #20242c;
  background: #f4f6f8;
}
.app-placeholder {
  min-height: 100vh;
  display: grid;
  place-content: center;
  text-align: center;
}
```

- [ ] **Step 6: Verify scaffold**

Run: `npm run typecheck`

Expected: exits with code 0.

Run: `npm run build`

Expected: exits with code 0 and creates `dist/`.

- [ ] **Step 7: Commit scaffold**

```bash
git add package.json package-lock.json electron.vite.config.ts electron-builder.yml tsconfig.json tsconfig.node.json tsconfig.web.json index.html src
git commit -m "chore: scaffold electron literature manager"
```

## Task 2: Shared Domain Types And Filters

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/constants.ts`
- Create: `src/shared/documentFilters.ts`
- Create: `src/shared/documentFilters.test.ts`

- [ ] **Step 1: Write failing filter tests**

Create `src/shared/documentFilters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filterAndSortDocuments } from "./documentFilters";
import type { DocumentRecord } from "./types";

const docs: DocumentRecord[] = [
  {
    id: "doc-a",
    title: "Attention Is All You Need",
    authors: "Vaswani",
    year: 2017,
    doi: "10.5555/attention",
    venue: "NeurIPS",
    fileType: "pdf",
    originalFileName: "attention.pdf",
    storedFileName: "doc-a.pdf",
    storedFilePath: "files/doc-a.pdf",
    categoryId: "deep-learning",
    categoryName: "深度学习",
    tags: ["Transformer", "必读"],
    importance: 5,
    readingStatus: "Intensive",
    note: "Read self-attention section again",
    createdAt: "2026-06-22T00:00:00.000Z",
    updatedAt: "2026-06-22T00:00:00.000Z",
    lastOpenedAt: null
  },
  {
    id: "doc-b",
    title: "U-Net",
    authors: "Ronneberger",
    year: 2015,
    doi: "",
    venue: "MICCAI",
    fileType: "pdf",
    originalFileName: "unet.pdf",
    storedFileName: "doc-b.pdf",
    storedFilePath: "files/doc-b.pdf",
    categoryId: "medical-imaging",
    categoryName: "医学影像",
    tags: ["分割"],
    importance: 4,
    readingStatus: "To Read",
    note: "",
    createdAt: "2026-06-23T00:00:00.000Z",
    updatedAt: "2026-06-23T00:00:00.000Z",
    lastOpenedAt: null
  }
];

describe("filterAndSortDocuments", () => {
  it("searches title, authors, tags, category, note, and doi", () => {
    expect(filterAndSortDocuments(docs, { query: "self-attention", sortBy: "title", sortDirection: "asc" }).map((doc) => doc.id)).toEqual(["doc-a"]);
    expect(filterAndSortDocuments(docs, { query: "医学", sortBy: "title", sortDirection: "asc" }).map((doc) => doc.id)).toEqual(["doc-b"]);
    expect(filterAndSortDocuments(docs, { query: "10.5555", sortBy: "title", sortDirection: "asc" }).map((doc) => doc.id)).toEqual(["doc-a"]);
  });

  it("filters by category, status, file type, tags, and minimum importance", () => {
    const result = filterAndSortDocuments(docs, {
      categoryId: "deep-learning",
      status: "Intensive",
      fileType: "pdf",
      tag: "Transformer",
      minImportance: 5,
      sortBy: "title",
      sortDirection: "asc"
    });

    expect(result.map((doc) => doc.id)).toEqual(["doc-a"]);
  });

  it("sorts by importance descending", () => {
    expect(filterAndSortDocuments(docs, { sortBy: "importance", sortDirection: "desc" }).map((doc) => doc.id)).toEqual(["doc-a", "doc-b"]);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `npm test -- src/shared/documentFilters.test.ts`

Expected: fails because `src/shared/documentFilters.ts` and shared types do not exist.

- [ ] **Step 3: Add shared types and constants**

Create `src/shared/types.ts`:

```ts
export type FileType = "pdf" | "doc" | "docx" | "txt" | "md";
export type ReadingStatus = "To Read" | "Reading" | "Read" | "Intensive";
export type SortDirection = "asc" | "desc";
export type DocumentSortKey = "title" | "authors" | "year" | "importance" | "readingStatus" | "createdAt" | "updatedAt" | "lastOpenedAt";

export interface CategoryRecord {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TagRecord {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRecord {
  id: string;
  title: string;
  authors: string;
  year: number | null;
  doi: string;
  venue: string;
  fileType: FileType;
  originalFileName: string;
  storedFileName: string;
  storedFilePath: string;
  categoryId: string | null;
  categoryName: string | null;
  tags: string[];
  importance: 1 | 2 | 3 | 4 | 5;
  readingStatus: ReadingStatus;
  note: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
}

export interface DocumentFilters {
  query?: string;
  categoryId?: string;
  tag?: string;
  fileType?: FileType;
  status?: ReadingStatus;
  minImportance?: 1 | 2 | 3 | 4 | 5;
  sortBy: DocumentSortKey;
  sortDirection: SortDirection;
}

export interface ImportCandidate {
  sourcePath: string;
  originalFileName: string;
  fileType: FileType;
  detectedTitle: string;
  detectedAuthors: string;
  detectedYear: number | null;
  detectedDoi: string;
  detectedVenue: string;
  extractionStatus: "detected" | "fallback";
}

export interface ImportConfirmation {
  sourcePath: string;
  title: string;
  authors: string;
  year: number | null;
  doi: string;
  venue: string;
  categoryId: string | null;
  tags: string[];
  importance: 1 | 2 | 3 | 4 | 5;
  readingStatus: ReadingStatus;
  note: string;
}

export interface LibrarySnapshot {
  documents: DocumentRecord[];
  categories: CategoryRecord[];
  tags: TagRecord[];
}
```

Create `src/shared/constants.ts`:

```ts
import type { FileType, ReadingStatus } from "./types";

export const SUPPORTED_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt", ".md", ".markdown"] as const;
export const SUPPORTED_FILE_TYPES: FileType[] = ["pdf", "doc", "docx", "txt", "md"];
export const READING_STATUSES: ReadingStatus[] = ["To Read", "Reading", "Read", "Intensive"];
export const DEFAULT_IMPORTANCE = 3 as const;
export const MIN_IMPORTANCE = 1;
export const MAX_IMPORTANCE = 5;
```

- [ ] **Step 4: Implement filter helper**

Create `src/shared/documentFilters.ts`:

```ts
import type { DocumentFilters, DocumentRecord } from "./types";

function includesText(value: string | number | null | undefined, query: string): boolean {
  return String(value ?? "").toLocaleLowerCase().includes(query);
}

function matchesQuery(doc: DocumentRecord, query?: string): boolean {
  const normalized = query?.trim().toLocaleLowerCase();
  if (!normalized) return true;

  return [
    doc.title,
    doc.authors,
    doc.year,
    doc.doi,
    doc.venue,
    doc.categoryName,
    doc.note,
    doc.tags.join(" ")
  ].some((value) => includesText(value, normalized));
}

function sortValue(doc: DocumentRecord, key: DocumentFilters["sortBy"]): string | number {
  const value = doc[key];
  if (typeof value === "number") return value;
  if (value === null) return "";
  return String(value).toLocaleLowerCase();
}

export function filterAndSortDocuments(documents: DocumentRecord[], filters: DocumentFilters): DocumentRecord[] {
  const filtered = documents.filter((doc) => {
    if (!matchesQuery(doc, filters.query)) return false;
    if (filters.categoryId && doc.categoryId !== filters.categoryId) return false;
    if (filters.tag && !doc.tags.includes(filters.tag)) return false;
    if (filters.fileType && doc.fileType !== filters.fileType) return false;
    if (filters.status && doc.readingStatus !== filters.status) return false;
    if (filters.minImportance && doc.importance < filters.minImportance) return false;
    return true;
  });

  return filtered.sort((left, right) => {
    const a = sortValue(left, filters.sortBy);
    const b = sortValue(right, filters.sortBy);
    const direction = filters.sortDirection === "asc" ? 1 : -1;
    if (a < b) return -1 * direction;
    if (a > b) return 1 * direction;
    return left.title.localeCompare(right.title) * direction;
  });
}
```

- [ ] **Step 5: Verify tests**

Run: `npm test -- src/shared/documentFilters.test.ts`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/shared
git commit -m "feat: add document filtering domain helpers"
```

## Task 3: Local Library Paths And SQLite Store

**Files:**
- Create: `src/main/libraryPaths.ts`
- Create: `src/main/libraryPaths.test.ts`
- Create: `src/main/database.ts`
- Create: `src/main/database.test.ts`
- Create: `src/main/documentRepository.ts`
- Create: `src/main/documentRepository.test.ts`

- [ ] **Step 1: Write failing path tests**

Create `src/main/libraryPaths.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveLibraryRoot } from "./libraryPaths";

describe("resolveLibraryRoot", () => {
  it("uses AppData for installed builds", () => {
    expect(resolveLibraryRoot({ isPackaged: true, appDataPath: "C:/Users/A/AppData/Roaming", exeDir: "C:/Program Files/App" })).toBe("C:\\Users\\A\\AppData\\Roaming\\Personal Literature Manager\\Library");
  });

  it("uses the executable parent directory for portable builds", () => {
    expect(resolveLibraryRoot({ isPackaged: false, appDataPath: "C:/Users/A/AppData/Roaming", exeDir: "D:/Tools/LitManager" })).toBe("D:\\Tools\\LitManager\\LiteratureLibrary");
  });
});
```

- [ ] **Step 2: Run failing path test**

Run: `npm test -- src/main/libraryPaths.test.ts`

Expected: fails because `resolveLibraryRoot` is not implemented.

- [ ] **Step 3: Implement path resolver**

Create `src/main/libraryPaths.ts`:

```ts
import { join, normalize } from "node:path";

export interface LibraryPathInput {
  isPackaged: boolean;
  appDataPath: string;
  exeDir: string;
}

export interface LibraryPaths {
  root: string;
  databasePath: string;
  filesDir: string;
  exportsDir: string;
}

export function resolveLibraryRoot(input: LibraryPathInput): string {
  const root = input.isPackaged
    ? join(input.appDataPath, "Personal Literature Manager", "Library")
    : join(input.exeDir, "LiteratureLibrary");
  return normalize(root);
}

export function buildLibraryPaths(root: string): LibraryPaths {
  return {
    root,
    databasePath: join(root, "library.db"),
    filesDir: join(root, "files"),
    exportsDir: join(root, "exports")
  };
}
```

- [ ] **Step 4: Write failing database tests**

Create `src/main/database.test.ts`:

```ts
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { openLibraryDatabase } from "./database";

describe("openLibraryDatabase", () => {
  it("creates the database file and schema", async () => {
    const root = await mkdtemp(join(tmpdir(), "lit-db-"));
    const db = await openLibraryDatabase({ databasePath: join(root, "library.db") });
    db.exec("insert into categories (id, name, parent_id, sort_order, created_at, updated_at) values ('cat-1', '深度学习', null, 0, '2026-06-22T00:00:00.000Z', '2026-06-22T00:00:00.000Z')");
    await db.save();
    const bytes = await readFile(join(root, "library.db"));
    expect(bytes.byteLength).toBeGreaterThan(100);
    db.close();
  });
});
```

- [ ] **Step 5: Implement sql.js database wrapper**

Create `src/main/database.ts`:

```ts
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

let sqlModule: SqlJsStatic | null = null;

async function loadSqlJs(): Promise<SqlJsStatic> {
  if (sqlModule) return sqlModule;
  sqlModule = await initSqlJs({
    locateFile: (file) => join(process.cwd(), "node_modules", "sql.js", "dist", file)
  });
  return sqlModule;
}

const schema = `
create table if not exists categories (
  id text primary key,
  name text not null unique,
  parent_id text null,
  sort_order integer not null default 0,
  created_at text not null,
  updated_at text not null
);
create table if not exists tags (
  id text primary key,
  name text not null unique,
  color text not null,
  created_at text not null,
  updated_at text not null
);
create table if not exists documents (
  id text primary key,
  title text not null,
  authors text not null default '',
  year integer null,
  doi text not null default '',
  venue text not null default '',
  file_type text not null,
  original_file_name text not null,
  stored_file_name text not null,
  stored_file_path text not null,
  category_id text null references categories(id),
  importance integer not null check (importance between 1 and 5),
  reading_status text not null,
  note text not null default '',
  created_at text not null,
  updated_at text not null,
  last_opened_at text null
);
create table if not exists document_tags (
  document_id text not null references documents(id) on delete cascade,
  tag_id text not null references tags(id) on delete cascade,
  primary key (document_id, tag_id)
);
create table if not exists app_settings (
  key text primary key,
  value text not null
);
`;

export interface LibraryDatabase {
  raw: Database;
  exec(sql: string, params?: unknown[]): void;
  select<T extends Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  save(): Promise<void>;
  close(): void;
}

export async function openLibraryDatabase(options: { databasePath: string }): Promise<LibraryDatabase> {
  await mkdir(dirname(options.databasePath), { recursive: true });
  const SQL = await loadSqlJs();
  let raw: Database;
  try {
    raw = new SQL.Database(await readFile(options.databasePath));
  } catch {
    raw = new SQL.Database();
  }
  raw.exec("PRAGMA foreign_keys = ON;");
  raw.exec(schema);

  return {
    raw,
    exec(sql, params = []) {
      const stmt = raw.prepare(sql);
      try {
        stmt.run(params as never[]);
      } finally {
        stmt.free();
      }
    },
    select<T extends Record<string, unknown>>(sql, params = []) {
      const stmt = raw.prepare(sql);
      const rows: T[] = [];
      try {
        stmt.bind(params as never[]);
        while (stmt.step()) rows.push(stmt.getAsObject() as T);
      } finally {
        stmt.free();
      }
      return rows;
    },
    async save() {
      await writeFile(options.databasePath, Buffer.from(raw.export()));
    },
    close() {
      raw.close();
    }
  };
}
```

- [ ] **Step 6: Write repository tests**

Create `src/main/documentRepository.test.ts` with tests for category creation, document creation, tag assignment, metadata update, and snapshot loading:

```ts
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { openLibraryDatabase } from "./database";
import { createDocumentRepository } from "./documentRepository";

describe("documentRepository", () => {
  it("stores documents with categories and tags", async () => {
    const root = await mkdtemp(join(tmpdir(), "lit-repo-"));
    const db = await openLibraryDatabase({ databasePath: join(root, "library.db") });
    const repo = createDocumentRepository(db);
    const category = await repo.upsertCategory({ name: "深度学习" });
    const doc = await repo.createDocument({
      title: "Attention Is All You Need",
      authors: "Vaswani",
      year: 2017,
      doi: "10.5555/attention",
      venue: "NeurIPS",
      fileType: "pdf",
      originalFileName: "attention.pdf",
      storedFileName: "doc-1.pdf",
      storedFilePath: "files/doc-1.pdf",
      categoryId: category.id,
      tags: ["Transformer", "必读"],
      importance: 5,
      readingStatus: "Intensive",
      note: "核心论文"
    });
    const snapshot = repo.getSnapshot();
    expect(snapshot.documents).toHaveLength(1);
    expect(snapshot.documents[0].id).toBe(doc.id);
    expect(snapshot.documents[0].tags).toEqual(["Transformer", "必读"]);
    expect(snapshot.categories[0].name).toBe("深度学习");
    db.close();
  });
});
```

- [ ] **Step 7: Implement repository**

Create `src/main/documentRepository.ts` with:

```ts
import type { CategoryRecord, DocumentRecord, FileType, ImportConfirmation, LibrarySnapshot, ReadingStatus, TagRecord } from "@shared/types";
import type { LibraryDatabase } from "./database";

const COLORS = ["#2563eb", "#0f766e", "#b45309", "#7c3aed", "#be123c"];

function now(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

interface CreateDocumentInput extends Omit<ImportConfirmation, "sourcePath"> {
  fileType: FileType;
  originalFileName: string;
  storedFileName: string;
  storedFilePath: string;
}

export function createDocumentRepository(db: LibraryDatabase) {
  function upsertCategory(input: { name: string }): CategoryRecord {
    const existing = db.select<CategoryRecord>("select id, name, parent_id as parentId, sort_order as sortOrder, created_at as createdAt, updated_at as updatedAt from categories where name = ?", [input.name])[0];
    if (existing) return existing;
    const timestamp = now();
    const record: CategoryRecord = { id: id("cat"), name: input.name, parentId: null, sortOrder: 0, createdAt: timestamp, updatedAt: timestamp };
    db.exec("insert into categories (id, name, parent_id, sort_order, created_at, updated_at) values (?, ?, ?, ?, ?, ?)", [record.id, record.name, record.parentId, record.sortOrder, record.createdAt, record.updatedAt]);
    return record;
  }

  function upsertTag(name: string): TagRecord {
    const existing = db.select<TagRecord>("select id, name, color, created_at as createdAt, updated_at as updatedAt from tags where name = ?", [name])[0];
    if (existing) return existing;
    const timestamp = now();
    const record: TagRecord = { id: id("tag"), name, color: COLORS[Math.floor(Math.random() * COLORS.length)], createdAt: timestamp, updatedAt: timestamp };
    db.exec("insert into tags (id, name, color, created_at, updated_at) values (?, ?, ?, ?, ?)", [record.id, record.name, record.color, record.createdAt, record.updatedAt]);
    return record;
  }

  function createDocument(input: CreateDocumentInput): DocumentRecord {
    const timestamp = now();
    const docId = id("doc");
    db.exec(
      "insert into documents (id, title, authors, year, doi, venue, file_type, original_file_name, stored_file_name, stored_file_path, category_id, importance, reading_status, note, created_at, updated_at, last_opened_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [docId, input.title, input.authors, input.year, input.doi, input.venue, input.fileType, input.originalFileName, input.storedFileName, input.storedFilePath, input.categoryId, input.importance, input.readingStatus, input.note, timestamp, timestamp, null]
    );
    for (const tagName of input.tags) {
      const tag = upsertTag(tagName);
      db.exec("insert or ignore into document_tags (document_id, tag_id) values (?, ?)", [docId, tag.id]);
    }
    return getDocument(docId);
  }

  function updateDocument(idValue: string, patch: Partial<Pick<DocumentRecord, "title" | "authors" | "year" | "doi" | "venue" | "categoryId" | "importance" | "readingStatus" | "note">> & { tags?: string[] }): DocumentRecord {
    const current = getDocument(idValue);
    const next = { ...current, ...patch, updatedAt: now() };
    db.exec(
      "update documents set title = ?, authors = ?, year = ?, doi = ?, venue = ?, category_id = ?, importance = ?, reading_status = ?, note = ?, updated_at = ? where id = ?",
      [next.title, next.authors, next.year, next.doi, next.venue, next.categoryId, next.importance, next.readingStatus, next.note, next.updatedAt, idValue]
    );
    if (patch.tags) {
      db.exec("delete from document_tags where document_id = ?", [idValue]);
      for (const tagName of patch.tags) {
        const tag = upsertTag(tagName);
        db.exec("insert or ignore into document_tags (document_id, tag_id) values (?, ?)", [idValue, tag.id]);
      }
    }
    return getDocument(idValue);
  }

  function getDocument(idValue: string): DocumentRecord {
    const doc = getSnapshot().documents.find((item) => item.id === idValue);
    if (!doc) throw new Error(`Document not found: ${idValue}`);
    return doc;
  }

  function getSnapshot(): LibrarySnapshot {
    const categories = db.select<CategoryRecord>("select id, name, parent_id as parentId, sort_order as sortOrder, created_at as createdAt, updated_at as updatedAt from categories order by sort_order, name");
    const tags = db.select<TagRecord>("select id, name, color, created_at as createdAt, updated_at as updatedAt from tags order by name");
    const documents = db.select<Record<string, unknown>>(
      "select d.id, d.title, d.authors, d.year, d.doi, d.venue, d.file_type as fileType, d.original_file_name as originalFileName, d.stored_file_name as storedFileName, d.stored_file_path as storedFilePath, d.category_id as categoryId, c.name as categoryName, d.importance, d.reading_status as readingStatus, d.note, d.created_at as createdAt, d.updated_at as updatedAt, d.last_opened_at as lastOpenedAt from documents d left join categories c on c.id = d.category_id order by d.updated_at desc"
    ).map((row) => ({
      ...(row as unknown as DocumentRecord),
      tags: db.select<{ name: string }>("select t.name from tags t join document_tags dt on dt.tag_id = t.id where dt.document_id = ? order by t.name", [row.id]).map((tag) => tag.name),
      year: row.year === null ? null : Number(row.year),
      importance: Number(row.importance) as DocumentRecord["importance"],
      readingStatus: row.readingStatus as ReadingStatus,
      fileType: row.fileType as FileType
    }));
    return { documents, categories, tags };
  }

  return { upsertCategory, upsertTag, createDocument, updateDocument, getSnapshot, getDocument };
}
```

- [ ] **Step 8: Verify database and repository**

Run: `npm test -- src/main/libraryPaths.test.ts src/main/database.test.ts src/main/documentRepository.test.ts`

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/main src/shared
git commit -m "feat: add local library database"
```

## Task 4: File Store And PDF Metadata Extraction

**Files:**
- Create: `src/main/fileStore.ts`
- Create: `src/main/fileStore.test.ts`
- Create: `src/main/pdfMetadata.ts`
- Create: `src/main/pdfMetadata.test.ts`

- [ ] **Step 1: Write metadata parser tests**

Create `src/main/pdfMetadata.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveMetadataFromPdfSignals } from "./pdfMetadata";

describe("deriveMetadataFromPdfSignals", () => {
  it("prefers embedded metadata and detects DOI and year from first-page text", () => {
    const result = deriveMetadataFromPdfSignals({
      fileName: "attention-is-all-you-need.pdf",
      embeddedTitle: "Attention Is All You Need",
      embeddedAuthor: "Ashish Vaswani; Noam Shazeer",
      firstPageText: "31st Conference on Neural Information Processing Systems 2017 DOI: 10.5555/3295222.3295349"
    });
    expect(result).toMatchObject({
      detectedTitle: "Attention Is All You Need",
      detectedAuthors: "Ashish Vaswani; Noam Shazeer",
      detectedYear: 2017,
      detectedDoi: "10.5555/3295222.3295349",
      extractionStatus: "detected"
    });
  });

  it("falls back to file name when no metadata is available", () => {
    const result = deriveMetadataFromPdfSignals({
      fileName: "diffusion-models-in-medical-imaging.pdf",
      embeddedTitle: "",
      embeddedAuthor: "",
      firstPageText: ""
    });
    expect(result.detectedTitle).toBe("diffusion models in medical imaging");
    expect(result.detectedAuthors).toBe("");
    expect(result.detectedYear).toBeNull();
    expect(result.extractionStatus).toBe("fallback");
  });
});
```

- [ ] **Step 2: Implement metadata derivation**

Create `src/main/pdfMetadata.ts`:

```ts
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { ImportCandidate } from "@shared/types";
import { extname, basename } from "node:path";

export interface PdfSignals {
  fileName: string;
  embeddedTitle: string;
  embeddedAuthor: string;
  firstPageText: string;
}

function clean(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function titleFromFile(fileName: string): string {
  return basename(fileName, extname(fileName)).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function detectYear(text: string): number | null {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function detectDoi(text: string): string {
  const match = text.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i);
  return match ? match[0].replace(/[.,;:]+$/, "") : "";
}

export function deriveMetadataFromPdfSignals(signals: PdfSignals): Pick<ImportCandidate, "detectedTitle" | "detectedAuthors" | "detectedYear" | "detectedDoi" | "detectedVenue" | "extractionStatus"> {
  const embeddedTitle = clean(signals.embeddedTitle);
  const embeddedAuthor = clean(signals.embeddedAuthor);
  const firstPageText = clean(signals.firstPageText);
  const detectedTitle = embeddedTitle || firstPageText.split(". ")[0]?.slice(0, 180).trim() || titleFromFile(signals.fileName);
  const detectedAuthors = embeddedAuthor;
  const detectedYear = detectYear(firstPageText);
  const detectedDoi = detectDoi(firstPageText);
  const extractionStatus = embeddedTitle || embeddedAuthor || detectedYear || detectedDoi ? "detected" : "fallback";

  return {
    detectedTitle,
    detectedAuthors,
    detectedYear,
    detectedDoi,
    detectedVenue: "",
    extractionStatus
  };
}

export async function extractPdfMetadata(sourcePath: string, fileName: string): Promise<ReturnType<typeof deriveMetadataFromPdfSignals>> {
  GlobalWorkerOptions.workerSrc = "";
  const loadingTask = getDocument({ url: sourcePath, disableWorker: true });
  const pdf = await loadingTask.promise;
  const metadata = await pdf.getMetadata().catch(() => ({ info: {} as Record<string, string> }));
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();
  const firstPageText = textContent.items.map((item) => "str" in item ? item.str : "").join(" ");
  const info = metadata.info as Record<string, string>;

  return deriveMetadataFromPdfSignals({
    fileName,
    embeddedTitle: info.Title ?? "",
    embeddedAuthor: info.Author ?? "",
    firstPageText
  });
}
```

- [ ] **Step 3: Write file store tests**

Create `src/main/fileStore.test.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createFileStore, detectFileType } from "./fileStore";

describe("fileStore", () => {
  it("detects supported file types", () => {
    expect(detectFileType("paper.PDF")).toBe("pdf");
    expect(detectFileType("notes.markdown")).toBe("md");
    expect(detectFileType("draft.docx")).toBe("docx");
  });

  it("copies imported files into managed storage", async () => {
    const root = join(tmpdir(), `lit-files-${Date.now()}`);
    const sourceDir = join(root, "source");
    const filesDir = join(root, "library", "files");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "paper.pdf");
    await writeFile(sourcePath, "pdf bytes");
    const store = createFileStore({ filesDir });
    const stored = await store.copyIntoLibrary(sourcePath, "doc-1", "paper.pdf");
    expect(await readFile(stored.absolutePath, "utf8")).toBe("pdf bytes");
    expect(stored.relativePath).toBe("files/doc-1.pdf");
  });
});
```

- [ ] **Step 4: Implement file store**

Create `src/main/fileStore.ts`:

```ts
import type { FileType } from "@shared/types";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { shell } from "electron";

export function detectFileType(fileName: string): FileType {
  const ext = extname(fileName).toLocaleLowerCase();
  if (ext === ".pdf") return "pdf";
  if (ext === ".doc") return "doc";
  if (ext === ".docx") return "docx";
  if (ext === ".txt") return "txt";
  if (ext === ".md" || ext === ".markdown") return "md";
  throw new Error(`Unsupported file type: ${basename(fileName)}`);
}

export function createFileStore(options: { filesDir: string }) {
  async function copyIntoLibrary(sourcePath: string, documentId: string, originalFileName: string): Promise<{ storedFileName: string; relativePath: string; absolutePath: string }> {
    await stat(sourcePath);
    await mkdir(options.filesDir, { recursive: true });
    const ext = extname(originalFileName).toLocaleLowerCase() || ".bin";
    const storedFileName = `${documentId}${ext}`;
    const absolutePath = join(options.filesDir, storedFileName);
    await copyFile(sourcePath, absolutePath);
    return { storedFileName, relativePath: `files/${storedFileName}`, absolutePath };
  }

  function toFileUrl(absolutePath: string): string {
    return pathToFileURL(absolutePath).toString();
  }

  async function openExternal(absolutePath: string): Promise<string> {
    return shell.openPath(absolutePath);
  }

  return { copyIntoLibrary, toFileUrl, openExternal };
}
```

- [ ] **Step 5: Verify metadata and file tests**

Run: `npm test -- src/main/pdfMetadata.test.ts src/main/fileStore.test.ts`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/main
git commit -m "feat: add file storage and pdf metadata helpers"
```

## Task 5: Import Service And IPC API

**Files:**
- Create: `src/main/importService.ts`
- Create: `src/main/importService.test.ts`
- Create: `src/main/ipcHandlers.ts`
- Modify: `src/main/main.ts`
- Modify: `src/main/preload.ts`
- Create: `src/renderer/api/client.ts`

- [ ] **Step 1: Write failing import service test**

Create `src/main/importService.test.ts`:

```ts
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { openLibraryDatabase } from "./database";
import { createDocumentRepository } from "./documentRepository";
import { createFileStore } from "./fileStore";
import { createImportService } from "./importService";

describe("importService", () => {
  it("creates candidates and confirms imports", async () => {
    const root = await mkdtemp(join(tmpdir(), "lit-import-"));
    const sourcePath = join(root, "sample.txt");
    await writeFile(sourcePath, "notes");
    const db = await openLibraryDatabase({ databasePath: join(root, "library.db") });
    const repo = createDocumentRepository(db);
    const store = createFileStore({ filesDir: join(root, "files") });
    const service = createImportService({ repo, store, extractPdfMetadata: async () => { throw new Error("not used for txt"); } });

    const candidates = await service.createCandidates([sourcePath]);
    expect(candidates[0]).toMatchObject({ originalFileName: "sample.txt", fileType: "txt", detectedTitle: "sample" });

    const imported = await service.confirmImports([
      {
        sourcePath,
        title: "My Notes",
        authors: "",
        year: null,
        doi: "",
        venue: "",
        categoryId: null,
        tags: ["笔记"],
        importance: 3,
        readingStatus: "To Read",
        note: ""
      }
    ]);
    expect(imported[0].title).toBe("My Notes");
    expect(imported[0].storedFileName.endsWith(".txt")).toBe(true);
    db.close();
  });
});
```

- [ ] **Step 2: Implement import service**

Create `src/main/importService.ts`:

```ts
import type { DocumentRecord, ImportCandidate, ImportConfirmation } from "@shared/types";
import { basename, extname } from "node:path";
import { DEFAULT_IMPORTANCE } from "@shared/constants";
import { detectFileType } from "./fileStore";
import type { createDocumentRepository } from "./documentRepository";
import type { createFileStore } from "./fileStore";

type Repository = ReturnType<typeof createDocumentRepository>;
type FileStore = ReturnType<typeof createFileStore>;

function fallbackTitle(fileName: string): string {
  return basename(fileName, extname(fileName)).replace(/[_-]+/g, " ").trim();
}

export function createImportService(options: {
  repo: Repository;
  store: FileStore;
  extractPdfMetadata: (sourcePath: string, fileName: string) => Promise<Pick<ImportCandidate, "detectedTitle" | "detectedAuthors" | "detectedYear" | "detectedDoi" | "detectedVenue" | "extractionStatus">>;
}) {
  async function createCandidates(sourcePaths: string[]): Promise<ImportCandidate[]> {
    const candidates: ImportCandidate[] = [];
    for (const sourcePath of sourcePaths) {
      const originalFileName = basename(sourcePath);
      const fileType = detectFileType(originalFileName);
      if (fileType === "pdf") {
        try {
          const detected = await options.extractPdfMetadata(sourcePath, originalFileName);
          candidates.push({ sourcePath, originalFileName, fileType, ...detected });
        } catch {
          candidates.push({ sourcePath, originalFileName, fileType, detectedTitle: fallbackTitle(originalFileName), detectedAuthors: "", detectedYear: null, detectedDoi: "", detectedVenue: "", extractionStatus: "fallback" });
        }
      } else {
        candidates.push({ sourcePath, originalFileName, fileType, detectedTitle: fallbackTitle(originalFileName), detectedAuthors: "", detectedYear: null, detectedDoi: "", detectedVenue: "", extractionStatus: "fallback" });
      }
    }
    return candidates;
  }

  async function confirmImports(confirmations: ImportConfirmation[]): Promise<DocumentRecord[]> {
    const imported: DocumentRecord[] = [];
    for (const confirmation of confirmations) {
      const originalFileName = basename(confirmation.sourcePath);
      const fileType = detectFileType(originalFileName);
      const documentId = crypto.randomUUID();
      const stored = await options.store.copyIntoLibrary(confirmation.sourcePath, documentId, originalFileName);
      imported.push(options.repo.createDocument({
        ...confirmation,
        title: confirmation.title.trim() || fallbackTitle(originalFileName),
        importance: confirmation.importance || DEFAULT_IMPORTANCE,
        fileType,
        originalFileName,
        storedFileName: stored.storedFileName,
        storedFilePath: stored.relativePath
      }));
    }
    return imported;
  }

  return { createCandidates, confirmImports };
}
```

- [ ] **Step 3: Verify import service**

Run: `npm test -- src/main/importService.test.ts`

Expected: passes.

- [ ] **Step 4: Add IPC handler structure**

Create `src/main/ipcHandlers.ts`:

```ts
import { dialog, ipcMain } from "electron";
import type { BrowserWindow } from "electron";
import type { ImportConfirmation } from "@shared/types";
import type { createDocumentRepository } from "./documentRepository";
import type { createImportService } from "./importService";

export function registerIpcHandlers(options: {
  window: BrowserWindow;
  repo: ReturnType<typeof createDocumentRepository>;
  importService: ReturnType<typeof createImportService>;
  saveDatabase: () => Promise<void>;
  getFileUrl: (documentId: string) => string;
  openExternal: (documentId: string) => Promise<string>;
  exportSelection: (documentIds: string[]) => Promise<string>;
  exportCategory: (categoryId: string | null) => Promise<string>;
  exportAll: () => Promise<string>;
}): void {
  ipcMain.handle("library:getSnapshot", () => options.repo.getSnapshot());
  ipcMain.handle("library:chooseImportFiles", async () => {
    const result = await dialog.showOpenDialog(options.window, {
      title: "导入文献",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Documents", extensions: ["pdf", "doc", "docx", "txt", "md", "markdown"] }]
    });
    if (result.canceled) return [];
    return options.importService.createCandidates(result.filePaths);
  });
  ipcMain.handle("library:confirmImports", async (_event, confirmations: ImportConfirmation[]) => {
    const imported = await options.importService.confirmImports(confirmations);
    await options.saveDatabase();
    return imported;
  });
  ipcMain.handle("library:updateDocument", async (_event, id: string, patch) => {
    const updated = options.repo.updateDocument(id, patch);
    await options.saveDatabase();
    return updated;
  });
  ipcMain.handle("library:getFileUrl", (_event, documentId: string) => options.getFileUrl(documentId));
  ipcMain.handle("library:openExternal", (_event, documentId: string) => options.openExternal(documentId));
  ipcMain.handle("library:exportSelection", (_event, ids: string[]) => options.exportSelection(ids));
  ipcMain.handle("library:exportCategory", (_event, categoryId: string | null) => options.exportCategory(categoryId));
  ipcMain.handle("library:exportAll", () => options.exportAll());
}
```

- [ ] **Step 5: Expose typed preload API**

Replace `src/main/preload.ts` with:

```ts
import { contextBridge, ipcRenderer } from "electron";
import type { DocumentRecord, ImportCandidate, ImportConfirmation, LibrarySnapshot } from "@shared/types";

export interface LiteratureApi {
  getSnapshot(): Promise<LibrarySnapshot>;
  chooseImportFiles(): Promise<ImportCandidate[]>;
  confirmImports(confirmations: ImportConfirmation[]): Promise<DocumentRecord[]>;
  updateDocument(id: string, patch: Partial<DocumentRecord> & { tags?: string[] }): Promise<DocumentRecord>;
  getFileUrl(documentId: string): Promise<string>;
  openExternal(documentId: string): Promise<string>;
  exportSelection(documentIds: string[]): Promise<string>;
  exportCategory(categoryId: string | null): Promise<string>;
  exportAll(): Promise<string>;
}

const api: LiteratureApi = {
  getSnapshot: () => ipcRenderer.invoke("library:getSnapshot"),
  chooseImportFiles: () => ipcRenderer.invoke("library:chooseImportFiles"),
  confirmImports: (confirmations) => ipcRenderer.invoke("library:confirmImports", confirmations),
  updateDocument: (id, patch) => ipcRenderer.invoke("library:updateDocument", id, patch),
  getFileUrl: (documentId) => ipcRenderer.invoke("library:getFileUrl", documentId),
  openExternal: (documentId) => ipcRenderer.invoke("library:openExternal", documentId),
  exportSelection: (documentIds) => ipcRenderer.invoke("library:exportSelection", documentIds),
  exportCategory: (categoryId) => ipcRenderer.invoke("library:exportCategory", categoryId),
  exportAll: () => ipcRenderer.invoke("library:exportAll")
};

contextBridge.exposeInMainWorld("literature", api);
```

Create `src/renderer/api/client.ts`:

```ts
import type { LiteratureApi } from "../../main/preload";

declare global {
  interface Window {
    literature: LiteratureApi;
  }
}

export const libraryApi = window.literature;
```

- [ ] **Step 6: Commit**

```bash
git add src/main src/renderer/api
git commit -m "feat: add import workflow ipc api"
```

## Task 6: Export Service

**Files:**
- Create: `src/main/exportService.ts`
- Create: `src/main/exportService.test.ts`

- [ ] **Step 1: Write failing export test**

Create `src/main/exportService.test.ts`:

```ts
import AdmZip from "adm-zip";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createExportService } from "./exportService";
import type { DocumentRecord, LibrarySnapshot } from "@shared/types";

function doc(id: string): DocumentRecord {
  return {
    id,
    title: "Paper",
    authors: "Author",
    year: 2026,
    doi: "",
    venue: "",
    fileType: "pdf",
    originalFileName: "paper.pdf",
    storedFileName: `${id}.pdf`,
    storedFilePath: `files/${id}.pdf`,
    categoryId: "cat-1",
    categoryName: "深度学习",
    tags: ["必读"],
    importance: 5,
    readingStatus: "To Read",
    note: "note",
    createdAt: "2026-06-22T00:00:00.000Z",
    updatedAt: "2026-06-22T00:00:00.000Z",
    lastOpenedAt: null
  };
}

describe("exportService", () => {
  it("exports selected documents with metadata", async () => {
    const root = await mkdtemp(join(tmpdir(), "lit-export-"));
    await mkdir(join(root, "files"), { recursive: true });
    await mkdir(join(root, "exports"), { recursive: true });
    await writeFile(join(root, "files", "doc-1.pdf"), "pdf");
    const snapshot: LibrarySnapshot = { documents: [doc("doc-1")], categories: [], tags: [] };
    const service = createExportService({ libraryRoot: root, exportsDir: join(root, "exports"), getSnapshot: () => snapshot });
    const zipPath = await service.exportSelection(["doc-1"]);
    const zip = new AdmZip(zipPath);
    expect(zip.getEntry("metadata.json")).toBeTruthy();
    expect(zip.getEntry("files/doc-1.pdf")).toBeTruthy();
    const metadata = JSON.parse(zip.readAsText("metadata.json")) as LibrarySnapshot;
    expect(metadata.documents[0].title).toBe("Paper");
  });
});
```

- [ ] **Step 2: Implement export service**

Create `src/main/exportService.ts`:

```ts
import AdmZip from "adm-zip";
import type { DocumentRecord, LibrarySnapshot } from "@shared/types";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export function createExportService(options: {
  libraryRoot: string;
  exportsDir: string;
  getSnapshot: () => LibrarySnapshot;
}) {
  async function writeZip(name: string, documents: DocumentRecord[]): Promise<string> {
    await mkdir(options.exportsDir, { recursive: true });
    const timestamp = new Date().toISOString().slice(0, 10);
    const zipPath = join(options.exportsDir, `${name}-${timestamp}.zip`);
    const zip = new AdmZip();
    const snapshot = options.getSnapshot();
    const selectedIds = new Set(documents.map((doc) => doc.id));
    const metadata: LibrarySnapshot = {
      documents,
      categories: snapshot.categories.filter((category) => documents.some((doc) => doc.categoryId === category.id)),
      tags: snapshot.tags.filter((tag) => documents.some((doc) => doc.tags.includes(tag.name)))
    };
    zip.addFile("metadata.json", Buffer.from(JSON.stringify(metadata, null, 2), "utf8"));
    for (const doc of snapshot.documents) {
      if (selectedIds.has(doc.id)) {
        zip.addLocalFile(join(options.libraryRoot, doc.storedFilePath), "files");
      }
    }
    zip.writeZip(zipPath);
    return zipPath;
  }

  return {
    exportSelection(documentIds: string[]) {
      const selected = options.getSnapshot().documents.filter((doc) => documentIds.includes(doc.id));
      return writeZip("selected-documents", selected);
    },
    exportCategory(categoryId: string | null) {
      const selected = options.getSnapshot().documents.filter((doc) => doc.categoryId === categoryId);
      return writeZip("category-documents", selected);
    },
    exportAll() {
      return writeZip("all-documents", options.getSnapshot().documents);
    }
  };
}
```

- [ ] **Step 3: Verify export**

Run: `npm test -- src/main/exportService.test.ts`

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/main/exportService.ts src/main/exportService.test.ts
git commit -m "feat: add backup export service"
```

## Task 7: Wire Main Process Services

**Files:**
- Modify: `src/main/main.ts`

- [ ] **Step 1: Wire database, repository, import, export, and IPC**

Update `src/main/main.ts` so `app.whenReady()` initializes:

```ts
import { app, BrowserWindow } from "electron";
import { dirname, join } from "node:path";
import { buildLibraryPaths, resolveLibraryRoot } from "./libraryPaths";
import { openLibraryDatabase } from "./database";
import { createDocumentRepository } from "./documentRepository";
import { createFileStore } from "./fileStore";
import { extractPdfMetadata } from "./pdfMetadata";
import { createImportService } from "./importService";
import { createExportService } from "./exportService";
import { registerIpcHandlers } from "./ipcHandlers";

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1050,
    minHeight: 720,
    title: "Personal Literature Manager",
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const root = resolveLibraryRoot({
    isPackaged: app.isPackaged,
    appDataPath: app.getPath("appData"),
    exeDir: dirname(app.getPath("exe"))
  });
  const paths = buildLibraryPaths(root);
  const db = await openLibraryDatabase({ databasePath: paths.databasePath });
  const repo = createDocumentRepository(db);
  const store = createFileStore({ filesDir: paths.filesDir });
  const importService = createImportService({ repo, store, extractPdfMetadata });
  const exportService = createExportService({ libraryRoot: root, exportsDir: paths.exportsDir, getSnapshot: repo.getSnapshot });

  registerIpcHandlers({
    window,
    repo,
    importService,
    saveDatabase: () => db.save(),
    getFileUrl: (documentId) => {
      const doc = repo.getDocument(documentId);
      return store.toFileUrl(join(root, doc.storedFilePath));
    },
    openExternal: async (documentId) => {
      const doc = repo.getDocument(documentId);
      return store.openExternal(join(root, doc.storedFilePath));
    },
    exportSelection: exportService.exportSelection,
    exportCategory: exportService.exportCategory,
    exportAll: exportService.exportAll
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await window.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => void createWindow());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
```

- [ ] **Step 2: Verify main process typecheck**

Run: `npm run typecheck`

Expected: exits with code 0.

- [ ] **Step 3: Commit**

```bash
git add src/main/main.ts
git commit -m "feat: wire electron main services"
```

## Task 8: Renderer App Shell And Library View

**Files:**
- Modify: `src/renderer/App.tsx`
- Create: `src/renderer/components/AppShell.tsx`
- Create: `src/renderer/components/LibraryView.tsx`
- Create: `src/renderer/components/Stars.tsx`
- Create: `src/renderer/components/TagEditor.tsx`
- Modify: `src/renderer/styles.css`
- Create: `src/renderer/components/LibraryView.test.tsx`

- [ ] **Step 1: Write component test**

Create `src/renderer/components/LibraryView.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LibraryView } from "./LibraryView";
import type { LibrarySnapshot } from "@shared/types";

const snapshot: LibrarySnapshot = {
  categories: [{ id: "cat-1", name: "深度学习", parentId: null, sortOrder: 0, createdAt: "", updatedAt: "" }],
  tags: [{ id: "tag-1", name: "Transformer", color: "#2563eb", createdAt: "", updatedAt: "" }],
  documents: [
    {
      id: "doc-1",
      title: "Attention Is All You Need",
      authors: "Vaswani",
      year: 2017,
      doi: "",
      venue: "",
      fileType: "pdf",
      originalFileName: "attention.pdf",
      storedFileName: "doc-1.pdf",
      storedFilePath: "files/doc-1.pdf",
      categoryId: "cat-1",
      categoryName: "深度学习",
      tags: ["Transformer"],
      importance: 5,
      readingStatus: "Intensive",
      note: "核心",
      createdAt: "",
      updatedAt: "",
      lastOpenedAt: null
    }
  ]
};

describe("LibraryView", () => {
  it("renders documents and opens reader for selected pdf", async () => {
    const onOpenReader = vi.fn();
    render(<LibraryView snapshot={snapshot} selectedDocumentId="doc-1" onSelectDocument={vi.fn()} onOpenReader={onOpenReader} onImport={vi.fn()} onExportAll={vi.fn()} onUpdateDocument={vi.fn()} />);
    expect(screen.getByText("Attention Is All You Need")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "打开阅读模式" }));
    expect(onOpenReader).toHaveBeenCalledWith("doc-1");
  });
});
```

- [ ] **Step 2: Implement Stars and TagEditor**

Create `src/renderer/components/Stars.tsx`:

```tsx
export function Stars(props: { value: number; onChange?: (value: 1 | 2 | 3 | 4 | 5) => void }): JSX.Element {
  return (
    <div className="stars" aria-label={`重要程度 ${props.value} 星`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" className={star <= props.value ? "star active" : "star"} onClick={() => props.onChange?.(star as 1 | 2 | 3 | 4 | 5)}>
          ★
        </button>
      ))}
    </div>
  );
}
```

Create `src/renderer/components/TagEditor.tsx`:

```tsx
export function TagEditor(props: { tags: string[]; onChange: (tags: string[]) => void }): JSX.Element {
  function addTag(value: string): void {
    const tag = value.trim();
    if (tag && !props.tags.includes(tag)) props.onChange([...props.tags, tag]);
  }

  return (
    <div className="tag-editor">
      <div className="tag-list">
        {props.tags.map((tag) => (
          <button key={tag} type="button" className="tag-pill" onClick={() => props.onChange(props.tags.filter((item) => item !== tag))}>
            {tag} ×
          </button>
        ))}
      </div>
      <input aria-label="添加标签" placeholder="输入标签后回车" onKeyDown={(event) => {
        if (event.key === "Enter") {
          addTag(event.currentTarget.value);
          event.currentTarget.value = "";
        }
      }} />
    </div>
  );
}
```

- [ ] **Step 3: Implement AppShell and LibraryView**

Create `src/renderer/components/AppShell.tsx`:

```tsx
export function AppShell(props: { mode: "library" | "reader"; onModeChange: (mode: "library" | "reader") => void; children: React.ReactNode }): JSX.Element {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>个人文献管理器</h1>
          <p>本地资料库 · 分类 · 标签 · 重要程度 · 备份</p>
        </div>
        <nav className="mode-tabs">
          <button className={props.mode === "library" ? "active" : ""} onClick={() => props.onModeChange("library")}>文献库</button>
          <button className={props.mode === "reader" ? "active" : ""} onClick={() => props.onModeChange("reader")}>阅读</button>
        </nav>
      </header>
      {props.children}
    </div>
  );
}
```

Create `src/renderer/components/LibraryView.tsx` with:

```tsx
import { filterAndSortDocuments } from "@shared/documentFilters";
import type { DocumentRecord, LibrarySnapshot } from "@shared/types";
import { Download, FilePlus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Stars } from "./Stars";
import { TagEditor } from "./TagEditor";

export function LibraryView(props: {
  snapshot: LibrarySnapshot;
  selectedDocumentId: string | null;
  onSelectDocument: (id: string) => void;
  onOpenReader: (id: string) => void;
  onImport: () => void;
  onExportAll: () => void;
  onUpdateDocument: (id: string, patch: Partial<DocumentRecord> & { tags?: string[] }) => void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const selected = props.snapshot.documents.find((doc) => doc.id === props.selectedDocumentId) ?? props.snapshot.documents[0] ?? null;
  const documents = useMemo(() => filterAndSortDocuments(props.snapshot.documents, { query, categoryId, sortBy: "importance", sortDirection: "desc" }), [props.snapshot.documents, query, categoryId]);

  return (
    <section className="workspace library-grid">
      <aside className="sidebar">
        <h2>分类</h2>
        <button className={!categoryId ? "nav-item active" : "nav-item"} onClick={() => setCategoryId(undefined)}>全部文献</button>
        {props.snapshot.categories.map((category) => (
          <button key={category.id} className={categoryId === category.id ? "nav-item active" : "nav-item"} onClick={() => setCategoryId(category.id)}>{category.name}</button>
        ))}
        <h2>快速筛选</h2>
        <button className="nav-item">五星重点</button>
        <button className="nav-item">待读</button>
      </aside>
      <main className="library-main">
        <div className="toolbar">
          <label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、作者、标签、备注、DOI" /></label>
          <button onClick={props.onExportAll}><Download size={16} />导出全部</button>
          <button className="primary" onClick={props.onImport}><FilePlus size={16} />导入文献</button>
        </div>
        <table className="document-table">
          <thead><tr><th>标题</th><th>作者</th><th>年份</th><th>分类</th><th>重要</th><th>状态</th></tr></thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className={selected?.id === doc.id ? "selected" : ""} onClick={() => props.onSelectDocument(doc.id)}>
                <td>{doc.title}</td><td>{doc.authors}</td><td>{doc.year ?? ""}</td><td>{doc.categoryName ?? "未分类"}</td><td>{"★".repeat(doc.importance)}</td><td>{doc.readingStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
      <aside className="detail-panel">
        {selected ? (
          <>
            <h2>选中文献</h2>
            <label>标题<input value={selected.title} onChange={(event) => props.onUpdateDocument(selected.id, { title: event.target.value })} /></label>
            <label>作者<input value={selected.authors} onChange={(event) => props.onUpdateDocument(selected.id, { authors: event.target.value })} /></label>
            <Stars value={selected.importance} onChange={(importance) => props.onUpdateDocument(selected.id, { importance })} />
            <TagEditor tags={selected.tags} onChange={(tags) => props.onUpdateDocument(selected.id, { tags })} />
            <label>备注<textarea value={selected.note} onChange={(event) => props.onUpdateDocument(selected.id, { note: event.target.value })} /></label>
            <button className="primary full" onClick={() => props.onOpenReader(selected.id)}>打开阅读模式</button>
          </>
        ) : <p>导入第一篇文献后会显示详情。</p>}
      </aside>
    </section>
  );
}
```

- [ ] **Step 4: Wire App state**

Replace `src/renderer/App.tsx` with state that loads `libraryApi.getSnapshot()`, tracks `mode`, `selectedDocumentId`, calls `libraryApi.updateDocument()`, and renders `AppShell` plus `LibraryView`.

- [ ] **Step 5: Style the shell**

Replace `src/renderer/styles.css` with CSS that creates the two-mode desktop UI: top bar 72px, three-column workspace, dense table, right detail panel, 8px card radius, icon buttons, stable table row height, no nested cards, and responsive single-column fallback below 1050px.

- [ ] **Step 6: Verify component and typecheck**

Run: `npm test -- src/renderer/components/LibraryView.test.tsx`

Expected: passes.

Run: `npm run typecheck`

Expected: exits with code 0.

- [ ] **Step 7: Commit**

```bash
git add src/renderer src/shared
git commit -m "feat: add library management interface"
```

## Task 9: Import Review Dialog

**Files:**
- Create: `src/renderer/components/ImportReviewDialog.tsx`
- Create: `src/renderer/components/ImportReviewDialog.test.tsx`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Write dialog test**

Create `src/renderer/components/ImportReviewDialog.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ImportReviewDialog } from "./ImportReviewDialog";
import type { ImportCandidate } from "@shared/types";

const candidate: ImportCandidate = {
  sourcePath: "C:/paper.pdf",
  originalFileName: "paper.pdf",
  fileType: "pdf",
  detectedTitle: "Detected Paper",
  detectedAuthors: "Author",
  detectedYear: 2026,
  detectedDoi: "10.1000/example",
  detectedVenue: "",
  extractionStatus: "detected"
};

describe("ImportReviewDialog", () => {
  it("lets the user edit detected metadata before saving", async () => {
    const onConfirm = vi.fn();
    render(<ImportReviewDialog candidates={[candidate]} onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.clear(screen.getByLabelText("标题"));
    await userEvent.type(screen.getByLabelText("标题"), "Edited Paper");
    await userEvent.click(screen.getByRole("button", { name: "保存导入" }));
    expect(onConfirm.mock.calls[0][0][0].title).toBe("Edited Paper");
  });
});
```

- [ ] **Step 2: Implement dialog**

Create `src/renderer/components/ImportReviewDialog.tsx`:

```tsx
import type { ImportCandidate, ImportConfirmation } from "@shared/types";
import { DEFAULT_IMPORTANCE } from "@shared/constants";
import { useState } from "react";

function toConfirmation(candidate: ImportCandidate): ImportConfirmation {
  return {
    sourcePath: candidate.sourcePath,
    title: candidate.detectedTitle,
    authors: candidate.detectedAuthors,
    year: candidate.detectedYear,
    doi: candidate.detectedDoi,
    venue: candidate.detectedVenue,
    categoryId: null,
    tags: [],
    importance: DEFAULT_IMPORTANCE,
    readingStatus: "To Read",
    note: ""
  };
}

export function ImportReviewDialog(props: { candidates: ImportCandidate[]; onConfirm: (items: ImportConfirmation[]) => void; onCancel: () => void }): JSX.Element {
  const [items, setItems] = useState(() => props.candidates.map(toConfirmation));
  function update(index: number, patch: Partial<ImportConfirmation>): void {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  return (
    <div className="modal-backdrop">
      <section className="modal import-dialog">
        <header><h2>确认导入信息</h2><p>自动识别结果可以修改后再保存。</p></header>
        <div className="import-list">
          {items.map((item, index) => (
            <article key={item.sourcePath} className="import-item">
              <strong>{props.candidates[index].originalFileName}</strong>
              <label>标题<input aria-label="标题" value={item.title} onChange={(event) => update(index, { title: event.target.value })} /></label>
              <label>作者<input aria-label="作者" value={item.authors} onChange={(event) => update(index, { authors: event.target.value })} /></label>
              <label>年份<input aria-label="年份" value={item.year ?? ""} onChange={(event) => update(index, { year: event.target.value ? Number(event.target.value) : null })} /></label>
              <label>DOI<input aria-label="DOI" value={item.doi} onChange={(event) => update(index, { doi: event.target.value })} /></label>
            </article>
          ))}
        </div>
        <footer>
          <button onClick={props.onCancel}>取消</button>
          <button className="primary" onClick={() => props.onConfirm(items)}>保存导入</button>
        </footer>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Wire import flow in App**

Update `src/renderer/App.tsx` so import button:

1. Calls `libraryApi.chooseImportFiles()`.
2. Opens `ImportReviewDialog` when candidates exist.
3. Calls `libraryApi.confirmImports(confirmations)` on save.
4. Refreshes `libraryApi.getSnapshot()`.
5. Selects the first imported document.

- [ ] **Step 4: Verify dialog**

Run: `npm test -- src/renderer/components/ImportReviewDialog.test.tsx`

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/renderer
git commit -m "feat: add import review dialog"
```

## Task 10: Reader Mode

**Files:**
- Create: `src/renderer/components/ReaderView.tsx`
- Create: `src/renderer/components/ReaderView.test.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`

- [ ] **Step 1: Write reader test**

Create `src/renderer/components/ReaderView.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReaderView } from "./ReaderView";
import type { LibrarySnapshot } from "@shared/types";

const snapshot: LibrarySnapshot = {
  categories: [],
  tags: [],
  documents: [{
    id: "doc-1",
    title: "PDF Paper",
    authors: "Author",
    year: 2026,
    doi: "",
    venue: "",
    fileType: "pdf",
    originalFileName: "paper.pdf",
    storedFileName: "doc-1.pdf",
    storedFilePath: "files/doc-1.pdf",
    categoryId: null,
    categoryName: null,
    tags: [],
    importance: 5,
    readingStatus: "Reading",
    note: "",
    createdAt: "",
    updatedAt: "",
    lastOpenedAt: null
  }]
};

describe("ReaderView", () => {
  it("renders a pdf iframe and metadata panel", () => {
    render(<ReaderView snapshot={snapshot} selectedDocumentId="doc-1" fileUrl="file:///C:/paper.pdf" onSelectDocument={vi.fn()} onBackToLibrary={vi.fn()} onUpdateDocument={vi.fn()} onOpenExternal={vi.fn()} />);
    expect(screen.getByTitle("PDF Paper")).toHaveAttribute("src", "file:///C:/paper.pdf");
    expect(screen.getByText("PDF Paper")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement ReaderView**

Create `src/renderer/components/ReaderView.tsx` with:

```tsx
import type { DocumentRecord, LibrarySnapshot } from "@shared/types";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Stars } from "./Stars";
import { TagEditor } from "./TagEditor";

export function ReaderView(props: {
  snapshot: LibrarySnapshot;
  selectedDocumentId: string | null;
  fileUrl: string | null;
  onSelectDocument: (id: string) => void;
  onBackToLibrary: () => void;
  onUpdateDocument: (id: string, patch: Partial<DocumentRecord> & { tags?: string[] }) => void;
  onOpenExternal: (id: string) => void;
}): JSX.Element {
  const selected = props.snapshot.documents.find((doc) => doc.id === props.selectedDocumentId) ?? props.snapshot.documents[0] ?? null;
  return (
    <section className="workspace reader-grid">
      <aside className="sidebar">
        <button className="nav-item" onClick={props.onBackToLibrary}><ArrowLeft size={16} />返回文献库</button>
        <h2>当前列表</h2>
        {props.snapshot.documents.map((doc) => (
          <button key={doc.id} className={doc.id === selected?.id ? "paper-mini active" : "paper-mini"} onClick={() => props.onSelectDocument(doc.id)}>
            <span>{doc.title}</span><small>{"★".repeat(doc.importance)} · {doc.readingStatus}</small>
          </button>
        ))}
      </aside>
      <main className="reader-main">
        {selected?.fileType === "pdf" && props.fileUrl ? <iframe className="pdf-frame" title={selected.title} src={props.fileUrl} /> : <div className="empty-reader"><p>此文件类型使用系统默认程序打开。</p>{selected && <button onClick={() => props.onOpenExternal(selected.id)}><ExternalLink size={16} />外部打开</button>}</div>}
      </main>
      <aside className="detail-panel">
        {selected ? (
          <>
            <h2>{selected.title}</h2>
            <p>{selected.authors} {selected.year ? `· ${selected.year}` : ""}</p>
            <Stars value={selected.importance} onChange={(importance) => props.onUpdateDocument(selected.id, { importance })} />
            <TagEditor tags={selected.tags} onChange={(tags) => props.onUpdateDocument(selected.id, { tags })} />
            <label>阅读状态<select value={selected.readingStatus} onChange={(event) => props.onUpdateDocument(selected.id, { readingStatus: event.target.value as DocumentRecord["readingStatus"] })}><option>To Read</option><option>Reading</option><option>Read</option><option>Intensive</option></select></label>
            <label>阅读笔记<textarea value={selected.note} onChange={(event) => props.onUpdateDocument(selected.id, { note: event.target.value })} /></label>
            <div className="ai-placeholder">AI 翻译、总结、分析区域已预留，第一版不启用。</div>
          </>
        ) : <p>请选择一篇文献。</p>}
      </aside>
    </section>
  );
}
```

- [ ] **Step 3: Wire selected PDF URL**

Update `src/renderer/App.tsx` so when mode is `reader` and selected file is PDF, it calls `libraryApi.getFileUrl(selectedDocumentId)` and passes the URL into `ReaderView`.

- [ ] **Step 4: Verify reader**

Run: `npm test -- src/renderer/components/ReaderView.test.tsx`

Expected: passes.

Run: `npm run typecheck`

Expected: exits with code 0.

- [ ] **Step 5: Commit**

```bash
git add src/renderer
git commit -m "feat: add reader mode"
```

## Task 11: Export Buttons And User Feedback

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/LibraryView.tsx`
- Modify: `src/renderer/styles.css`

- [ ] **Step 1: Add export handlers**

Update `App.tsx` so:

- Export all calls `libraryApi.exportAll()`.
- Export selected calls `libraryApi.exportSelection([selectedDocumentId])`.
- Export current category calls `libraryApi.exportCategory(categoryId)`.
- Success message shows the returned zip path.
- Failure message shows the thrown error message.

- [ ] **Step 2: Add toolbar buttons**

Update `LibraryView.tsx` toolbar to include:

- `导出选中`
- `导出当前分类`
- `导出全部`

Disable `导出选中` when no document is selected.

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`

Expected: exits with code 0.

- [ ] **Step 4: Commit**

```bash
git add src/renderer
git commit -m "feat: expose backup export actions"
```

## Task 12: Packaging Configuration

**Files:**
- Modify: `electron-builder.yml`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Configure electron-builder**

Create or replace `electron-builder.yml`:

```yaml
appId: com.local.personal-literature-manager
productName: Personal Literature Manager
directories:
  output: release
files:
  - dist/**
  - package.json
extraResources:
  - from: node_modules/sql.js/dist/sql-wasm.wasm
    to: sql-wasm.wasm
win:
  target:
    - nsis
    - portable
  artifactName: "${productName}-${version}-${arch}-${target}.${ext}"
nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
portable:
  artifactName: "${productName}-${version}-portable.${ext}"
```

- [ ] **Step 2: Adjust sql.js locateFile for packaged builds**

Update `src/main/database.ts` so `locateFile` checks `process.resourcesPath` when `process.env.NODE_ENV !== "test"` and the resource exists. Keep the node_modules path for tests and dev.

- [ ] **Step 3: Verify packaged build command**

Run: `npm run dist:win`

Expected:

- `release/Personal Literature Manager-0.1.0-x64-nsis.exe`
- `release/Personal Literature Manager-0.1.0-portable.exe`

- [ ] **Step 4: Commit**

```bash
git add electron-builder.yml package.json package-lock.json src/main/database.ts .gitignore
git commit -m "build: configure windows installer and portable outputs"
```

## Task 13: Manual Verification Pass

**Files:**
- Create: `docs/superpowers/verification/2026-06-22-literature-manager-v1.md`

- [ ] **Step 1: Create verification checklist**

Create `docs/superpowers/verification/2026-06-22-literature-manager-v1.md` with these rows:

```md
# Literature Manager V1 Verification

- [ ] Fresh launch creates a local library directory and `library.db`.
- [ ] Import PDF with embedded metadata creates editable title, author, year, and DOI suggestions.
- [ ] Import PDF with missing metadata falls back to file name as title.
- [ ] Import TXT file stores it and opens it externally.
- [ ] Edit title, author, stars, status, tags, and notes from Library mode.
- [ ] Search matches title, author, category, tag, note, and DOI.
- [ ] Reader mode shows a PDF in the center panel.
- [ ] Reader mode edits stars, tags, status, and notes.
- [ ] Export selected document creates a zip with `metadata.json` and file content.
- [ ] Export current category creates a zip with only that category's documents.
- [ ] Export all creates a zip with all documents.
- [ ] Installer EXE starts on Windows without Node.js installed.
- [ ] Portable EXE starts from a copied folder and creates `LiteratureLibrary` beside it.
```

- [ ] **Step 2: Run automated checks**

Run: `npm run typecheck`

Expected: exits with code 0.

Run: `npm test`

Expected: exits with code 0.

Run: `npm run dist:win`

Expected: exits with code 0 and writes installer plus portable artifacts to `release/`.

- [ ] **Step 3: Run manual checklist**

Open the dev app with `npm run dev`, complete every verification row possible in development mode, then run the packaged portable EXE and complete the packaging-specific rows.

- [ ] **Step 4: Commit verification notes**

```bash
git add docs/superpowers/verification/2026-06-22-literature-manager-v1.md
git commit -m "test: document literature manager verification"
```

## Self-Review

Spec coverage:

- Import PDF, Word, TXT, and Markdown: Task 4 and Task 5.
- Copy imported files into managed storage: Task 4 and Task 5.
- Library mode with categories, tags, search, sorting, status, stars, and notes: Task 2, Task 3, Task 8, Task 11.
- Reader mode with PDF preview and metadata editing: Task 10.
- PDF metadata extraction for title, authors, year, DOI, and fallback: Task 4 and Task 9.
- Backup export for selected documents, category, and full library: Task 6 and Task 11.
- Local SQLite database: Task 3.
- Windows installer and portable EXE: Task 12.
- Clean Windows verification without developer tools: Task 13.

Placeholder scan:

- The plan contains no placeholder markers or open-ended implementation steps.
- Each task has exact files, commands, and expected outcomes.

Type consistency:

- Shared domain names use `DocumentRecord`, `CategoryRecord`, `TagRecord`, `ImportCandidate`, `ImportConfirmation`, and `LibrarySnapshot`.
- Main-process service factories use `createDocumentRepository`, `createFileStore`, `createImportService`, and `createExportService`.
- Renderer API uses `window.literature` through `libraryApi`.
