import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import initSqlJs from 'sql.js'

type SqlValue = string | number | Uint8Array | null
type SqlParams = SqlValue[] | Record<string, SqlValue>
type SqlRow = Record<string, SqlValue>

interface SqlJsDatabase {
  exec(sql: string): Array<{
    columns: string[]
    values: SqlValue[][]
  }>
  run(sql: string, params?: SqlParams): void
  prepare(
    sql: string,
    values?: SqlParams,
  ): {
    step: () => boolean
    getAsObject: () => SqlRow
    free: () => void
  }
  export(): Uint8Array
  close(): void
}

interface SqlJsStatic {
  Database: new (data?: Uint8Array) => SqlJsDatabase
}

export interface OpenLibraryDatabaseInput {
  databasePath: string
}

export interface LibraryDatabase {
  raw: SqlJsDatabase
  exec(sql: string, params?: SqlParams): void
  select<T extends SqlRow = SqlRow>(sql: string, params?: SqlParams): T[]
  transaction<T>(fn: () => T): T
  save(): Promise<void>
  close(): void
}

const schemaSql = `
create table if not exists categories (
  id text primary key,
  name text not null unique,
  parent_id text,
  sort_order integer not null default 0,
  created_at text not null,
  updated_at text not null,
  foreign key (parent_id) references categories(id) on delete set null
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
  authors text not null,
  year integer,
  doi text not null,
  venue text not null,
  file_type text not null check (file_type in ('pdf', 'doc', 'docx', 'txt', 'md')),
  original_file_name text not null,
  stored_file_name text not null,
  stored_file_path text not null,
  category_id text,
  importance integer not null check (importance between 1 and 5),
  reading_status text not null check (reading_status in ('To Read', 'Reading', 'Read', 'Intensive')),
  note text not null,
  created_at text not null,
  updated_at text not null,
  last_opened_at text,
  foreign key (category_id) references categories(id) on delete set null
);

create table if not exists document_tags (
  document_id text not null,
  tag_id text not null,
  primary key (document_id, tag_id),
  foreign key (document_id) references documents(id) on delete cascade,
  foreign key (tag_id) references tags(id) on delete cascade
);

create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at text not null
);
`

export function locateSqlJsFile(fileName: string) {
  const nodeModulesPath = join(
    process.cwd(),
    'node_modules',
    'sql.js',
    'dist',
    fileName,
  )

  if (process.env.NODE_ENV === 'test') {
    return nodeModulesPath
  }

  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string })
    .resourcesPath

  if (resourcesPath) {
    const packagedPath = join(resourcesPath, fileName)

    if (existsSync(packagedPath)) {
      return packagedPath
    }
  }

  return nodeModulesPath
}

function mapResults<T extends SqlRow>(
  result: { columns: string[]; values: SqlValue[][] } | undefined,
): T[] {
  if (!result) {
    return []
  }

  return result.values.map((values) =>
    Object.fromEntries(
      result.columns.map((column, index) => [column, values[index] ?? null]),
    ),
  ) as T[]
}

export async function openLibraryDatabase({
  databasePath,
}: OpenLibraryDatabaseInput): Promise<LibraryDatabase> {
  const SQL = (await initSqlJs({ locateFile: locateSqlJsFile })) as SqlJsStatic
  const raw = existsSync(databasePath)
    ? new SQL.Database(readFileSync(databasePath))
    : new SQL.Database()

  raw.run('pragma foreign_keys = on')
  raw.exec(schemaSql)

  let transactionDepth = 0

  return {
    raw,
    exec(sql, params) {
      raw.run(sql, params)
    },
    select<T extends SqlRow = SqlRow>(sql: string, params?: SqlParams): T[] {
      if (!params) {
        return mapResults<T>(raw.exec(sql)[0])
      }

      const statement = raw.prepare(sql, params)
      const rows: T[] = []

      try {
        while (statement.step()) {
          rows.push(statement.getAsObject() as T)
        }
      } finally {
        statement.free()
      }

      return rows
    },
    transaction<T>(fn: () => T): T {
      const savepointName = `transaction_${transactionDepth}`

      if (transactionDepth === 0) {
        raw.run('begin')
      } else {
        raw.run(`savepoint ${savepointName}`)
      }

      transactionDepth += 1

      try {
        const result = fn()
        transactionDepth -= 1

        if (transactionDepth === 0) {
          raw.run('commit')
        } else {
          raw.run(`release savepoint ${savepointName}`)
        }

        return result
      } catch (error) {
        transactionDepth -= 1

        if (transactionDepth === 0) {
          raw.run('rollback')
        } else {
          raw.run(`rollback to savepoint ${savepointName}`)
          raw.run(`release savepoint ${savepointName}`)
        }

        throw error
      }
    },
    async save() {
      await mkdir(dirname(databasePath), { recursive: true })
      await writeFile(databasePath, raw.export())
    },
    close() {
      raw.close()
    },
  }
}
