import type { ReactNode } from 'react'

interface AppShellProps {
  mode: 'library' | 'reader'
  onModeChange: (mode: 'library' | 'reader') => void
  children: ReactNode
}

export function AppShell({
  mode,
  onModeChange,
  children,
}: AppShellProps): JSX.Element {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>个人文献管理器</h1>
          <p>本地资料库 · 分类 · 标签 · 重要程度 · 备份</p>
        </div>
        <nav className="mode-tabs" aria-label="工作模式">
          <button
            className={mode === 'library' ? 'is-active' : ''}
            onClick={() => onModeChange('library')}
            type="button"
          >
            文献库
          </button>
          <button
            className={mode === 'reader' ? 'is-active' : ''}
            onClick={() => onModeChange('reader')}
            type="button"
          >
            阅读
          </button>
        </nav>
      </header>
      <main className="app-workspace">{children}</main>
    </div>
  )
}
