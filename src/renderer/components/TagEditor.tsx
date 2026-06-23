import { KeyboardEvent, useState } from 'react'

interface TagEditorProps {
  tags: string[]
  onChange?: (tags: string[]) => void
}

export function TagEditor({ tags, onChange }: TagEditorProps): JSX.Element {
  const [draft, setDraft] = useState('')

  const removeTag = (tagToRemove: string) => {
    onChange?.(tags.filter((tag) => tag !== tagToRemove))
  }

  const addTag = () => {
    const nextTag = draft.trim()

    if (!nextTag || tags.includes(nextTag)) {
      setDraft('')
      return
    }

    onChange?.([...tags, nextTag])
    setDraft('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addTag()
    }
  }

  return (
    <div className="tag-editor">
      <div className="tag-list" aria-label="标签">
        {tags.map((tag) => (
          <button
            className="tag-pill"
            key={tag}
            onClick={() => removeTag(tag)}
            type="button"
          >
            {tag}
          </button>
        ))}
      </div>
      <input
        aria-label="添加标签"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入标签后回车"
        type="text"
        value={draft}
      />
    </div>
  )
}
