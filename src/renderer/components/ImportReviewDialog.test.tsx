// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ImportCandidate } from '../../shared/types'
import { ImportReviewDialog } from './ImportReviewDialog'

afterEach(() => {
  cleanup()
})

describe('ImportReviewDialog', () => {
  it('confirms edited import metadata', () => {
    const candidate: ImportCandidate = {
      sourcePath: 'C:/paper.pdf',
      originalFileName: 'paper.pdf',
      fileType: 'pdf',
      detectedTitle: 'Detected Paper',
      detectedAuthors: 'Author',
      detectedYear: 2026,
      detectedDoi: '10.1000/example',
      detectedVenue: '',
      extractionStatus: 'detected',
    }
    const onConfirm = vi.fn()

    render(
      <ImportReviewDialog
        candidates={[candidate]}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    fireEvent.change(screen.getByLabelText('标题'), {
      target: { value: 'Edited Paper' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存导入' }))

    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({ title: 'Edited Paper' }),
    ])
  })
})
