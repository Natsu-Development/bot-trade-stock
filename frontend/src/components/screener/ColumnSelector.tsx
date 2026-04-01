import { memo } from 'react'
import { Icons } from '../icons/Icons'
import { Button } from '@/components/ui/button'
import type { TableColumn } from '@/hooks/useTableColumns'

interface ColumnSelectorProps {
  columnsByCategory: Record<string, { label: string; columns: TableColumn[] }>
  visibleColumns: ReadonlySet<string>
  onToggle: (columnId: string) => void
  onReset: () => void
}

export const ColumnSelector = memo(function ColumnSelector({
  columnsByCategory,
  visibleColumns,
  onToggle,
  onReset,
}: ColumnSelectorProps) {
  const visibleCount = visibleColumns.size
  const totalCount = Object.values(columnsByCategory).reduce((acc, cat) => acc + cat.columns.length, 0)

  return (
    <div className="relative group">
      <Button variant="ghost" className="text-xs px-3 py-1.5 h-8">
        <Icons.GridSmall />
        <span>Columns ({visibleCount})</span>
      </Button>
      
      {/* Dropdown */}
      <div className="absolute right-0 top-full mt-1 z-50 hidden group-hover:block">
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-dim)] rounded-lg shadow-xl min-w-[280px] p-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--border-dim)]">
            <span className="text-xs font-medium text-[var(--text-primary)]">
              Show/Hide Columns
            </span>
            <button
              onClick={onReset}
              className="text-[10px] text-[var(--neon-cyan)] hover:text-[var(--text-primary)] transition-colors"
            >
              Reset
            </button>
          </div>

          {/* Column Categories */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {Object.entries(columnsByCategory).map(([key, { label, columns }]) => (
              <div key={key}>
                <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                  {label}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {columns.map(col => (
                    <label
                      key={col.id}
                      className={`
                        flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs
                        transition-colors
                        ${col.id === 'symbol' 
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'hover:bg-[var(--bg-hover)]'
                        }
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(col.id)}
                        onChange={() => onToggle(col.id)}
                        disabled={col.id === 'symbol'}
                        className="w-3.5 h-3.5 rounded border-[var(--border-dim)] bg-[var(--bg-surface)] 
                          checked:bg-[var(--neon-cyan)] checked:border-[var(--neon-cyan)]
                          focus:ring-1 focus:ring-[var(--neon-cyan)] focus:ring-offset-0
                          disabled:opacity-50"
                      />
                      <span className={`${visibleColumns.has(col.id) ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                        {col.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-3 pt-2 border-t border-[var(--border-dim)] text-[10px] text-[var(--text-muted)]">
            {visibleCount} of {totalCount} columns visible
          </div>
        </div>
      </div>
    </div>
  )
})
