import type { AppSettings } from '../../shared/types'

interface SettingsDialogProps {
  settings: AppSettings
  onChooseDefaultExportDirectory: () => void | Promise<void>
  onChooseLibraryRoot: () => void | Promise<void>
  onClose: () => void
}

export function SettingsDialog({
  settings,
  onChooseDefaultExportDirectory,
  onChooseLibraryRoot,
  onClose,
}: SettingsDialogProps): JSX.Element {
  return (
    <div className="modal-backdrop">
      <section
        aria-label="设置"
        aria-modal="true"
        className="settings-dialog"
        role="dialog"
      >
        <div className="settings-header">
          <div>
            <h2>设置</h2>
            <p>管理文献库保存位置和默认导出位置。</p>
          </div>
          <button className="icon-button" onClick={onClose} type="button">
            关闭
          </button>
        </div>
        <div className="settings-content">
          <section className="settings-row">
            <div>
              <h3>文献库位置</h3>
              <p>{settings.libraryRoot}</p>
            </div>
            <button
              className="primary-button"
              onClick={() => void onChooseLibraryRoot()}
              type="button"
            >
              更改文献库位置
            </button>
          </section>
          <section className="settings-row">
            <div>
              <h3>默认导出位置</h3>
              <p>{settings.defaultExportDir ?? '未设置'}</p>
            </div>
            <button
              className="primary-button"
              onClick={() => void onChooseDefaultExportDirectory()}
              type="button"
            >
              更改默认导出位置
            </button>
          </section>
        </div>
      </section>
    </div>
  )
}
