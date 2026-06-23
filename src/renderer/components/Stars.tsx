interface StarsProps {
  value: 1 | 2 | 3 | 4 | 5
  onChange?: (value: 1 | 2 | 3 | 4 | 5) => void
}

const starValues = [1, 2, 3, 4, 5] as const

export function Stars({ value, onChange }: StarsProps): JSX.Element {
  return (
    <div
      className="stars"
      aria-label={`重要程度 ${value} / 5`}
      role="group"
    >
      {starValues.map((star) => (
        <button
          aria-label={`设置为 ${star} 星，当前 ${value} 星`}
          className={star <= value ? 'star-button is-active' : 'star-button'}
          disabled={!onChange}
          key={star}
          onClick={() => onChange?.(star)}
          type="button"
        >
          ★
        </button>
      ))}
    </div>
  )
}
