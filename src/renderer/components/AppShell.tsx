import type { ReactNode } from 'react'
import { Settings } from 'lucide-react'

interface AppShellProps {
  mode: 'library' | 'reader'
  onModeChange: (mode: 'library' | 'reader') => void
  onOpenSettings: () => void
  children: ReactNode
}

export function AppShell({
  mode,
  onModeChange,
  onOpenSettings,
  children,
}: AppShellProps): JSX.Element {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>个人文献管理器</h1>
          <p>本地资料库 · 分类 · 标签 · 重要程度 · 备份</p>
        </div>
        <div className="topbar-actions">
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
          <button
            aria-label="设置"
            className="icon-only-button"
            onClick={onOpenSettings}
            title="设置"
            type="button"
          >
            <Settings aria-hidden="true" size={18} />
          </button>
        </div>
      </header>
      <main className="app-workspace">{children}</main>
    </div>
  )
}
