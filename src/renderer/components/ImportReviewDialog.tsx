import { useEffect, useState } from 'react'
import { DEFAULT_IMPORTANCE } from '../../shared/constants'
import type { ImportCandidate, ImportConfirmation } from '../../shared/types'

interface ImportReviewDialogProps {
  candidates: ImportCandidate[]
  onConfirm: (items: ImportConfirmation[]) => void
  onCancel: () => void
}

function candidateToConfirmation(
  candidate: ImportCandidate,
): ImportConfirmation {
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
    readingStatus: 'To Read',
    note: '',
  }
}

export function ImportReviewDialog({
  candidates,
  onCancel,
  onConfirm,
}: ImportReviewDialogProps): JSX.Element {
  const [items, setItems] = useState<ImportConfirmation[]>(() =>
    candidates.map(candidateToConfirmation),
  )

  useEffect(() => {
    setItems(candidates.map(candidateToConfirmation))
  }, [candidates])

  const updateItem = (
    index: number,
    patch: Partial<Pick<ImportConfirmation, 'title' | 'authors' | 'year' | 'doi'>>,
  ) => {
    setItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    )
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="import-review-title"
        className="import-review-dialog"
        role="dialog"
      >
        <header className="import-review-header">
          <div>
            <h2 id="import-review-title">确认导入信息</h2>
            <p>自动识别结果可以修改后再保存。</p>
          </div>
          <button className="icon-button" onClick={onCancel} type="button">
            取消
          </button>
        </header>

        <div className="import-review-list">
          {items.map((item, index) => {
            const candidate = candidates[index]
            const inputId = `import-${index}`

            return (
              <fieldset className="import-review-item" key={item.sourcePath}>
                <legend>
                  <span>{candidate.originalFileName}</span>
                  <span>{candidate.fileType.toUpperCase()}</span>
                </legend>
                <div className="import-review-grid">
                  <label htmlFor={`${inputId}-title`}>
                    标题
                    <input
                      id={`${inputId}-title`}
                      onChange={(event) =>
                        updateItem(index, { title: event.target.value })
                      }
                      type="text"
                      value={item.title}
                    />
                  </label>
                  <label htmlFor={`${inputId}-authors`}>
                    作者
                    <input
                      id={`${inputId}-authors`}
                      onChange={(event) =>
                        updateItem(index, { authors: event.target.value })
                      }
                      type="text"
                      value={item.authors}
                    />
                  </label>
                  <label htmlFor={`${inputId}-year`}>
                    年份
                    <input
                      id={`${inputId}-year`}
                      onChange={(event) =>
                        updateItem(index, {
                          year:
                            event.target.value === ''
                              ? null
                              : Number(event.target.value),
                        })
                      }
                      type="number"
                      value={item.year ?? ''}
                    />
                  </label>
                  <label htmlFor={`${inputId}-doi`}>
                    DOI
                    <input
                      id={`${inputId}-doi`}
                      onChange={(event) =>
                        updateItem(index, { doi: event.target.value })
                      }
                      type="text"
                      value={item.doi}
                    />
                  </label>
                </div>
              </fieldset>
            )
          })}
        </div>

        <footer className="import-review-actions">
          <button className="icon-button" onClick={onCancel} type="button">
            取消
          </button>
          <button
            className="primary-button"
            onClick={() => onConfirm(items)}
            type="button"
          >
            保存导入
          </button>
        </footer>
      </section>
    </div>
  )
}
