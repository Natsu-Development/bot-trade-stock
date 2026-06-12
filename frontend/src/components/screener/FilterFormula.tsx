import { memo } from 'react'
import { cn } from '@/lib/utils'
import { formulaSegments, formulaTokenClass } from '@/lib/filterSerialize'
import type { FilterTreeNode } from '@/types'

interface FilterFormulaProps {
  root: FilterTreeNode
  className?: string
}

/**
 * Colored, inline-per-level rendering of a filter tree — same-level conditions on
 * one line, nested groups on indented lines. Shared by the Config preset card and
 * the Query Builder live preview.
 */
export const FilterFormula = memo(function FilterFormula({ root, className }: FilterFormulaProps) {
  const lines = formulaSegments(root)
  if (lines.length === 0) {
    return (
      <span className={cn('font-mono text-xs text-[var(--text-muted)]', className)}>
        (any stock)
      </span>
    )
  }
  return (
    <div className={cn('font-mono text-xs leading-relaxed', className)}>
      {lines.map((line, i) => (
        <div key={i} className="break-words" style={{ paddingLeft: `${line.indent}rem` }}>
          {line.tokens.map((tk, j) => (
            <span key={j} className={formulaTokenClass(tk.kind, tk.text)}>
              {tk.text}
              {j < line.tokens.length - 1 ? ' ' : ''}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
})
