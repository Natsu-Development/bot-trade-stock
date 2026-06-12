import { useState } from 'react'
import { cn } from '@/lib/utils'
import { QuickPresets } from './QuickPresets'
import { SavedFilterChips } from './SavedFilterChips'
import { QueryBuilder } from './QueryBuilder'
import { ColoredFormulaEditor } from './ColoredFormulaEditor'
import { makeBranch, makeLeaf } from '@/lib/filterSerialize'
import type { FilterTreeNode, QuickPreset } from '../../types'
import type { ScreenerFilterPreset } from '@/lib/api'
import type { LoadedPreset } from '@/hooks/screener/useScreenerFilters'

interface FilterBarProps {
  /** Canonical filter tree (the screener's single source of truth). */
  filterTree: FilterTreeNode
  /** Provenance of the active filter (drives the identity line + chip highlight). */
  loadedPreset: LoadedPreset | null
  /** The live tree diverges from the loaded preset's baseline. */
  isModified: boolean
  activeExchange: string
  builderOpen: boolean
  /** User-saved presets (config.metrics_filter). */
  savedFilters: ScreenerFilterPreset[]
  /** Commit a parsed tree from FREE-TEXT editing (formula box). */
  onTreeChange: (root: FilterTreeNode) => void
  /** Load a built-in quick preset (auto-applies). */
  onSelectBuiltIn: (name: string, root: FilterTreeNode) => void
  onExchangeChange: (exchange: string) => void
  onOpenBuilder: () => void
  onCloseBuilder: () => void
  onApplyBuilder: (root: FilterTreeNode, exchanges: string[]) => void
  /** Load / delete a saved preset by name. */
  onLoadPreset: (name: string) => void
  onDeletePreset: (name: string) => void
  /** Save the current tree as a named preset. */
  onSavePreset: (root: FilterTreeNode, exchanges: string[], name: string) => void
}

/** Built-in quick filters — each builds a fresh canonical tree on select. */
const builtInPresets: QuickPreset[] = [
  {
    id: 'momentum',
    name: 'Momentum',
    icon: '🚀',
    filters: [
      { field: 'rs_52w', operator: '>=', value: 80 },
      { field: 'rs_3m', operator: '>=', value: 75 },
      { field: 'volume_vs_sma', operator: '>', value: 30 },
    ],
  },
  {
    id: 'breakout',
    name: 'Breakout',
    icon: '⚡',
    filters: [
      { field: 'rs_52w', operator: '>=', value: 70 },
      { field: 'volume_vs_sma', operator: '>', value: 80 },
    ],
  },
  {
    id: 'trending-up',
    name: 'Trending Up',
    icon: '📈',
    filters: [
      { field: 'rs_52w', operator: '>=', value: 70 },
      { field: 'rs_6m', operator: '>=', value: 70 },
      { field: 'rs_3m', operator: '>=', value: 70 },
    ],
  },
  {
    id: 'volume-surge',
    name: 'Volume Surge',
    icon: '📊',
    filters: [{ field: 'volume_vs_sma', operator: '>', value: 150 }],
  },
  {
    id: 'swing-trade',
    name: 'Swing Trade',
    icon: '🔄',
    filters: [
      { field: 'rs_52w', operator: '>=', value: 60 },
      { field: 'rs_52w', operator: '<=', value: 85 },
      { field: 'volume_vs_sma', operator: '>', value: 50 },
    ],
  },
]

const exchanges = ['All', 'HOSE', 'HNX', 'UPCOM'] as const

/** Build a canonical AND-tree from a built-in preset's flat condition list. */
function presetToTree(preset: QuickPreset): FilterTreeNode {
  return makeBranch(
    'and',
    preset.filters.map((f) => makeLeaf(f.field, f.operator, f.value))
  )
}

export function FilterBar({
  filterTree,
  loadedPreset,
  isModified,
  activeExchange,
  builderOpen,
  savedFilters,
  onTreeChange,
  onSelectBuiltIn,
  onExchangeChange,
  onOpenBuilder,
  onCloseBuilder,
  onApplyBuilder,
  onLoadPreset,
  onDeletePreset,
  onSavePreset,
}: FilterBarProps) {
  // Save ▾ popover. saveAsName: null = "save as new" form closed; '' or text = open.
  const [saveMenuOpen, setSaveMenuOpen] = useState(false)
  const [saveAsName, setSaveAsName] = useState<string | null>(null)

  const exchangesForSave = activeExchange !== 'All' ? [activeExchange] : []

  const isSavedLoaded = loadedPreset?.source === 'saved'
  const builtinActiveName = loadedPreset?.source === 'builtin' ? loadedPreset.name : null

  const handleSelectPreset = (preset: QuickPreset) => {
    onSelectBuiltIn(preset.name, presetToTree(preset))
  }

  const closeSaveMenu = () => {
    setSaveMenuOpen(false)
    setSaveAsName(null)
  }

  const commitUpdate = () => {
    if (!loadedPreset) return
    onSavePreset(filterTree, exchangesForSave, loadedPreset.name)
    closeSaveMenu()
  }

  const commitSaveAs = () => {
    const n = (saveAsName ?? '').trim()
    if (!n) return
    onSavePreset(filterTree, exchangesForSave, n)
    closeSaveMenu()
  }

  // Builder provenance (US-06): the modal title + subline reflect the loaded filter.
  const builderTitle = loadedPreset
    ? `Editing: ★ ${loadedPreset.name}${isModified ? ' · modified' : ''}`
    : 'New filter'
  const builderSubtitle = ((): string => {
    if (!loadedPreset) return 'Custom — not saved as a preset'
    if (loadedPreset.source === 'saved')
      return isModified ? 'Modified from your saved preset' : 'Your saved preset'
    return isModified ? 'Modified from a built-in quick filter' : 'Built-in quick filter'
  })()

  return (
    <div className="flex flex-col gap-4">
      <QuickPresets
        presets={builtInPresets}
        activeName={builtinActiveName}
        modified={isModified}
        onSelectPreset={handleSelectPreset}
      />

      {/* Saved Filters — user presets (config.metrics_filter), always visible. */}
      <div className="flex flex-col gap-2" data-testid="saved-filters">
        <span className="text-[13px] font-medium text-[var(--text-secondary)]">Saved Filters</span>
        {savedFilters.length === 0 ? (
          <span className="text-[12px] text-[var(--text-muted)]">
            No saved filters yet — edit a query and use “💾 Save ▾”.
          </span>
        ) : (
          <SavedFilterChips
            savedFilters={savedFilters}
            loadedPreset={loadedPreset}
            isModified={isModified}
            onLoad={onLoadPreset}
            onDelete={onDeletePreset}
          />
        )}
      </div>

      {/* Exchanges (outer AND). */}
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-[var(--text-secondary)]">Exchanges</span>
        <div className="flex items-center gap-2">
          {exchanges.map((exchange) => (
            <button
              key={exchange}
              className={cn(
                'px-3.5 py-1.5 text-[13px] font-medium rounded transition-all duration-200',
                'bg-[var(--bg-elevated)] border border-[var(--border-dim)] text-[var(--text-secondary)]',
                'hover:bg-[var(--bg-hover)]',
                activeExchange === exchange &&
                  'bg-[var(--neon-cyan-dim)] border-[var(--neon-cyan)] text-[var(--neon-cyan)]'
              )}
              onClick={() => onExchangeChange(exchange)}
              type="button"
            >
              {exchange}
            </button>
          ))}
        </div>
      </div>

      {/* ── Current Filter card — identity + single colored editable box ──────── */}
      <div
        data-testid="current-filter"
        className="rounded-lg border border-[var(--border-dim)] bg-[var(--bg-surface)] p-3.5"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {/* Identity line (provenance) */}
          <div data-testid="current-filter-identity" className="flex items-center gap-1.5 text-sm">
            {loadedPreset ? (
              <>
                <span className="text-[var(--neon-amber)]">★</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {loadedPreset.name}
                </span>
                {isModified && (
                  <span className="text-[12px] text-[var(--neon-amber)]">· modified</span>
                )}
              </>
            ) : (
              <span className="font-medium text-[var(--text-secondary)]">Custom filter</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Save ▾ */}
            <div className="relative">
              <button
                type="button"
                data-testid="filter-save-menu"
                aria-expanded={saveMenuOpen}
                onClick={() => {
                  setSaveMenuOpen((v) => !v)
                  setSaveAsName(null)
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--neon-cyan)] bg-[var(--neon-cyan-dim)] px-3 py-1.5 text-[13px] font-medium text-[var(--neon-cyan)] transition-all duration-200 hover:brightness-110"
              >
                💾 Save ▾
              </button>

              {saveMenuOpen && (
                <div
                  data-testid="filter-save-popover"
                  className="absolute right-0 z-20 mt-1.5 w-64 rounded-lg border border-[var(--border-glow)] bg-[var(--bg-surface)] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
                >
                  {isSavedLoaded && (
                    <button
                      type="button"
                      data-testid="filter-save-update"
                      disabled={!isModified}
                      onClick={commitUpdate}
                      title={isModified ? undefined : 'No changes to save'}
                      className={cn(
                        'mb-1 block w-full rounded px-2.5 py-2 text-left text-[13px] font-medium',
                        isModified
                          ? 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                          : 'cursor-not-allowed text-[var(--text-muted)] opacity-60'
                      )}
                    >
                      Update “{loadedPreset?.name}”
                    </button>
                  )}

                  {saveAsName === null ? (
                    <button
                      type="button"
                      data-testid="filter-save-as-new"
                      onClick={() => setSaveAsName('')}
                      className="block w-full rounded px-2.5 py-2 text-left text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                    >
                      Save as new…
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2 p-1">
                      <input
                        type="text"
                        autoFocus
                        value={saveAsName}
                        onChange={(e) => setSaveAsName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            commitSaveAs()
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault()
                            setSaveAsName(null)
                          }
                        }}
                        placeholder="Preset name, e.g. High Momentum"
                        data-testid="filter-save-name"
                        className="w-full rounded border border-[var(--border-dim)] bg-[var(--bg-deep)] px-2.5 py-1.5 text-[13px] text-[var(--text-primary)] focus:border-[var(--neon-cyan)] focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSaveAsName(null)}
                          className="rounded px-2.5 py-1 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          data-testid="filter-save-confirm"
                          onClick={commitSaveAs}
                          disabled={saveAsName.trim().length === 0}
                          className={cn(
                            'rounded border border-[var(--neon-bull)] bg-[var(--neon-bull-dim)] px-2.5 py-1 text-[12px] font-medium text-[var(--neon-bull)]',
                            saveAsName.trim().length === 0 && 'cursor-not-allowed opacity-40'
                          )}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Open builder */}
            <button
              type="button"
              onClick={onOpenBuilder}
              data-testid="open-builder"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-glow)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-primary)] transition-all duration-200 hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)]"
            >
              ⚙ Open builder
            </button>
          </div>
        </div>

        <ColoredFormulaEditor tree={filterTree} onTreeChange={onTreeChange} />
      </div>

      {builderOpen && (
        <QueryBuilder
          initialRoot={filterTree}
          initialExchanges={activeExchange !== 'All' ? [activeExchange] : []}
          title={builderTitle}
          subtitle={builderSubtitle}
          // Exchange is owned by the screener's tabs (outer AND); the builder only
          // edits the boolean query. A save still captures the active exchange.
          showExchanges={false}
          onDone={(root, ex) => onApplyBuilder(root, ex)}
          onCancel={onCloseBuilder}
          onSavePreset={onSavePreset}
        />
      )}
    </div>
  )
}
