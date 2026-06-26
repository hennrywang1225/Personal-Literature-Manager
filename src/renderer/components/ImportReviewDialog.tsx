import { useEffect, useState } from 'react'
import { DEFAULT_IMPORTANCE } from '../../shared/constants'
import type { ImportCandidate, ImportConfirmation } from '../../shared/types'

interface ImportReviewDialogProps {
  candidates: ImportCandidate[]
  defaultCategoryId?: string | null
  onConfirm: (items: ImportConfirmation[]) => void
  onCancel: () => void
  submitError?: string | null
}

type ImportDraft = Omit<ImportConfirmation, 'year'> & {
  yearInput: string
}

type ImportFieldErrors = Partial<Record<number, { year?: string }>>

function candidateToConfirmation(
  candidate: ImportCandidate,
  defaultCategoryId: string | null,
): ImportDraft {
  return {
    sourcePath: candidate.sourcePath,
    title: candidate.detectedTitle,
    authors: candidate.detectedAuthors,
    yearInput: candidate.detectedYear?.toString() ?? '',
    doi: candidate.detectedDoi,
    venue: candidate.detectedVenue,
    categoryId: defaultCategoryId,
    tags: [],
    importance: DEFAULT_IMPORTANCE,
    readingStatus: 'To Read',
    note: '',
  }
}

export function ImportReviewDialog({
  candidates,
  defaultCategoryId = null,
  onCancel,
  onConfirm,
  submitError,
}: ImportReviewDialogProps): JSX.Element {
  const [items, setItems] = useState<ImportDraft[]>(() =>
    candidates.map((candidate) =>
      candidateToConfirmation(candidate, defaultCategoryId),
    ),
  )
  const [fieldErrors, setFieldErrors] = useState<ImportFieldErrors>({})

  useEffect(() => {
    setItems(
      candidates.map((candidate) =>
        candidateToConfirmation(candidate, defaultCategoryId),
      ),
    )
    setFieldErrors({})
  }, [candidates, defaultCategoryId])

  const updateItem = (
    index: number,
    patch: Partial<Pick<ImportDraft, 'title' | 'authors' | 'yearInput' | 'doi'>>,
  ) => {
    setItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    )

    if ('yearInput' in patch) {
      setFieldErrors((currentErrors) => ({
        ...currentErrors,
        [index]: { ...currentErrors[index], year: undefined },
      }))
    }
  }

  const buildConfirmations = (): ImportConfirmation[] | null => {
    const nextErrors: ImportFieldErrors = {}

    const confirmations = items.map((item, index) => {
      const trimmedYear = item.yearInput.trim()
      const year = trimmedYear === '' ? null : Number(trimmedYear)

      if (
        trimmedYear !== '' &&
        (!Number.isFinite(year) || !Number.isInteger(year))
      ) {
        nextErrors[index] = { year: '年份必须是有效整数。' }
      }

      return {
        ...item,
        year,
      }
    })

    setFieldErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return null
    }

    return confirmations.map(({ yearInput: _yearInput, ...confirmation }) => confirmation)
  }

  const handleConfirm = () => {
    const confirmations = buildConfirmations()

    if (confirmations) {
      onConfirm(confirmations)
    }
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

        {submitError ? (
          <p className="import-review-error" role="alert">
            {submitError}
          </p>
        ) : null}

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
                          yearInput: event.target.value,
                        })
                      }
                      step={1}
                      type="number"
                      value={item.yearInput}
                    />
                    {fieldErrors[index]?.year ? (
                      <span className="import-review-field-error">
                        {fieldErrors[index]?.year}
                      </span>
                    ) : null}
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
            onClick={handleConfirm}
            type="button"
          >
            保存导入
          </button>
        </footer>
      </section>
    </div>
  )
}
