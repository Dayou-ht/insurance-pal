import type { Person } from '../types'

interface Props {
  label: string
  value?: number
  onChange?: (id: number) => void
  multiple?: boolean
  values?: number[]
  onAdd?: (id: number) => void
  onRemove?: (id: number) => void
  persons: Person[]
  onNewPerson?: (field: 'holder' | 'insured' | 'beneficiary') => void
}

export default function PersonSelector({ label, value, onChange, multiple, values, onAdd, onRemove, persons, onNewPerson }: Props) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex gap-2">
        <select
          value={multiple ? '' : value || ''}
          onChange={e => {
            const id = Number(e.target.value)
            if (id) {
              if (multiple && onAdd) onAdd(id)
              else if (onChange) onChange(id)
            }
          }}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="">选择已有成员</option>
          {persons.filter(p => multiple ? !values?.includes(p.id!) : true).map(p => (
            <option key={p.id} value={p.id}>{p.name}（{p.relation}）</option>
          ))}
        </select>
        <button type="button" onClick={() => onNewPerson?.(
          multiple ? (label === '被保人' ? 'insured' : 'beneficiary') : 'holder'
        )}
          className="px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 whitespace-nowrap">
          + 新建
        </button>
      </div>
      {multiple && values && values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {values.map(id => {
            const p = persons.find(pp => pp.id === id)
            return p ? (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">
                {p.name}
                <button onClick={() => onRemove?.(id)} className="hover:text-red-500">×</button>
              </span>
            ) : null
          })}
        </div>
      )}
    </div>
  )
}
