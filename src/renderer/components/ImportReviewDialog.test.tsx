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

  it('confirms edited import metadata', () => {
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

  it('converts an empty year to null before confirming', () => {
    const onConfirm = vi.fn()

    render(
      <ImportReviewDialog
        candidates={[candidate]}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    fireEvent.change(screen.getByLabelText('年份'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存导入' }))

    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({ year: null }),
    ])
  })

  it('shows a field error and blocks save for an invalid year', () => {
    const onConfirm = vi.fn()

    render(
      <ImportReviewDialog
        candidates={[candidate]}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    fireEvent.change(screen.getByLabelText('年份'), {
      target: { value: '2026.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存导入' }))

    expect(screen.getByText('年份必须是有效整数。')).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('shows submit errors inside the dialog', () => {
    render(
      <ImportReviewDialog
        candidates={[candidate]}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        submitError="保存失败"
      />,
    )

    expect(screen.getByText('保存失败')).toBeInTheDocument()
  })
})
