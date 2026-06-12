import { useState, useCallback, useEffect, useMemo } from 'react'
import { api, getConfigId, type ApiTradingConfig } from '@/lib/api'
import type { ScreenerFilterPreset, ApiFilterRequest } from '@/lib/api'
import { toast } from '@/components/ui/Toast'
import type { FilterTreeNode } from '@/types'
import { apiNodeToTree, makeBranch, mapTreeToApiFormat, treesEqual } from '@/lib/filterSerialize'

// The default is an EMPTY filter (no conditions) — the "no filter, all stocks" state.
// An empty AND-branch serializes to '' / {match:'and'} (backend returns all stocks) and
// the formula box + collapsed summary render the empty/"(all stocks)" state.
const getDefaultTree = (): FilterTreeNode => makeBranch('and', [])

/** Where the currently-loaded filter came from. */
export type PresetSource = 'builtin' | 'saved'

/**
 * Provenance of the active filter — the SINGLE source of truth that drives the
 * Current Filter identity line, the chip highlights (both rows), and the builder
 * title. `baseline` is the tree as loaded; `isModified` = the live tree no longer
 * equals it. `null` ⇒ "Custom filter".
 */
export interface LoadedPreset {
  source: PresetSource
  name: string
  baseline: FilterTreeNode
}

function stripReadonlyFields(
  config: ApiTradingConfig
): Omit<ApiTradingConfig, 'created_at' | 'updated_at'> {
  const { created_at: _, updated_at: __, ...rest } = config
  return rest
}

export interface UseScreenerFiltersResult {
  savedFilters: ScreenerFilterPreset[]
  /** Provenance of the active filter (built-in / saved / null = custom). */
  loadedPreset: LoadedPreset | null
  /** The live tree no longer matches the loaded preset's baseline. */
  isModified: boolean
  /** Canonical filter tree — the single source of truth for the screener query. */
  filterTree: FilterTreeNode
  /** The tree the RESULTS currently reflect (hybrid apply). */
  appliedTree: FilterTreeNode
  /** The edited tree differs from the applied tree → there are unapplied changes. */
  dirty: boolean
  /** Whether the Query Builder pop-up is open over the screener. */
  builderOpen: boolean
  /** Commit a new canonical tree from FREE-TEXT editing (formula box). Provenance
   *  survives (→ "· modified"); does NOT auto-apply (→ dirty until Apply). */
  setFilterTree: (root: FilterTreeNode) => void
  /** Load a built-in quick preset (auto-applies). */
  selectBuiltIn: (name: string, root: FilterTreeNode) => void
  openBuilder: () => void
  closeBuilder: () => void
  /** Apply the builder's edited tree + exchanges and close the pop-up (auto-applies). */
  applyBuilder: (root: FilterTreeNode, exchanges: string[]) => void
  /** Commit the edited tree to the results (the explicit Apply button). */
  applyFilter: () => void
  handleReset: () => void
  /** Save an arbitrary tree as a named preset (Query Builder / Save ▾). */
  savePreset: (name: string, root: FilterTreeNode, exchanges?: string[]) => Promise<void>
  handleLoadPreset: (presetName: string) => void
  handleDeletePreset: (presetName: string) => Promise<void>
  loadSavedFilters: () => Promise<void>
  getFilterRequest: () => ApiFilterRequest
}

export function useScreenerFilters(): UseScreenerFiltersResult {
  const [savedFilters, setSavedFilters] = useState<ScreenerFilterPreset[]>([])
  const [loadedPreset, setLoadedPreset] = useState<LoadedPreset | null>(null)
  // Canonical filter tree. The formula box and the builder pop-up both edit this.
  const [filterTree, setFilterTreeState] = useState<FilterTreeNode>(getDefaultTree)
  // The tree the RESULTS reflect. Presets + builder "Done" commit it immediately
  // (auto-apply); free-text edits leave it stale until the Apply button fires
  // (→ dirty). `getFilterRequest()` serializes THIS tree.
  const [appliedTree, setAppliedTree] = useState<FilterTreeNode>(getDefaultTree)
  const [builderOpen, setBuilderOpen] = useState(false)

  // Memoized: treesEqual canonicalizes + JSON.stringifies both trees, so guard it
  // behind the (immutable) tree refs rather than recomputing on every consumer render.
  const isModified = useMemo(
    () => loadedPreset != null && !treesEqual(filterTree, loadedPreset.baseline),
    [loadedPreset, filterTree]
  )
  const dirty = useMemo(() => !treesEqual(filterTree, appliedTree), [filterTree, appliedTree])

  // Free-text commit (formula box): provenance survives so the identity reads
  // "★ name · modified"; appliedTree untouched so the Apply button lights.
  const setFilterTree = useCallback((root: FilterTreeNode) => {
    setFilterTreeState(root)
  }, [])

  // Reset to the default (empty) tree → "no filter, all stocks". Shared by the
  // Reset button, the saved-filter chip toggle, and the quick-filter toggle. Defined
  // ABOVE selectBuiltIn so the latter can list it as a dependency without a TDZ.
  const handleReset = useCallback(() => {
    const def = getDefaultTree()
    setFilterTreeState(def)
    setAppliedTree(def)
    setLoadedPreset(null)
  }, [])

  // Built-in quick preset → load + auto-apply. Re-clicking the ACTIVE built-in
  // un-selects it → reset to the default (empty) tree, so a second click toggles the
  // quick filter off (all stocks). Mirrors the saved-filter chip toggle in
  // handleLoadPreset so both chip rows behave identically (select/un-select).
  const selectBuiltIn = useCallback(
    (name: string, root: FilterTreeNode) => {
      if (loadedPreset?.source === 'builtin' && loadedPreset.name === name) {
        handleReset()
        return
      }
      setFilterTreeState(root)
      setAppliedTree(root)
      setLoadedPreset({ source: 'builtin', name, baseline: root })
    },
    [loadedPreset, handleReset]
  )

  const openBuilder = useCallback(() => setBuilderOpen(true), [])

  const closeBuilder = useCallback(() => setBuilderOpen(false), [])

  // Builder "Done" → commit + auto-apply. Provenance survives (still editing the
  // same loaded preset, now possibly modified vs its baseline).
  const applyBuilder = useCallback((root: FilterTreeNode, _exchanges: string[]) => {
    setFilterTreeState(root)
    setAppliedTree(root)
    setBuilderOpen(false)
  }, [])

  // Explicit Apply (free-text edits) → commit the edited tree to the results.
  const applyFilter = useCallback(() => {
    setAppliedTree(filterTree)
  }, [filterTree])

  const loadSavedFilters = useCallback(async () => {
    try {
      const configId = getConfigId()
      const config = await api.getConfig(configId)
      setSavedFilters(config.metrics_filter || [])
    } catch (error) {
      console.error('Failed to load saved filters:', error)
    }
  }, [])

  useEffect(() => {
    loadSavedFilters()
  }, [loadSavedFilters])

  // Persist an arbitrary tree as a named preset (Query Builder "Save as preset" /
  // the Current Filter "Save ▾"). Reuses api.getConfig/updateConfig — no backend
  // change. After saving, the active filter IS that saved preset → rebase
  // provenance so "· modified" clears.
  const savePreset = useCallback(
    async (name: string, root: FilterTreeNode, exchanges?: string[]) => {
      const trimmed = name.trim()
      if (!trimmed) {
        toast.error('Please enter a filter name')
        return
      }

      try {
        const configId = getConfigId()
        const config = await api.getConfig(configId)

        // Persist the given tree as a flat StockFilter preset (match/conditions/groups).
        const apiFilter = mapTreeToApiFormat(root, exchanges)
        const newPreset: ScreenerFilterPreset = {
          name: trimmed,
          ...apiFilter,
          created_at: new Date().toISOString(),
        }

        const currentFilters = config.metrics_filter || []
        const existingIndex = currentFilters.findIndex((f) => f.name === trimmed)

        let updatedFilters: ScreenerFilterPreset[]
        if (existingIndex >= 0) {
          updatedFilters = [...currentFilters]
          updatedFilters[existingIndex] = newPreset
          toast.success('Filter updated successfully')
        } else {
          updatedFilters = [...currentFilters, newPreset]
          toast.success('Filter saved successfully')
        }

        await api.updateConfig(configId, {
          ...stripReadonlyFields(config),
          metrics_filter: updatedFilters,
        })

        setSavedFilters(updatedFilters)
        setLoadedPreset({ source: 'saved', name: trimmed, baseline: root })
      } catch (error) {
        console.error('Failed to save filter:', error)
        toast.error('Failed to save filter')
      }
    },
    []
  )

  const handleLoadPreset = useCallback(
    (presetName: string) => {
      // Re-clicking the active saved filter un-selects it → reset to the default (empty)
      // tree, so a second click toggles the filter off (all stocks).
      if (loadedPreset?.source === 'saved' && loadedPreset.name === presetName) {
        handleReset()
        return
      }

      const preset = savedFilters.find((f) => f.name === presetName)
      if (!preset) return

      // Hydrate the flat preset into the canonical tree + auto-apply.
      const tree = apiNodeToTree(preset)
      setFilterTreeState(tree)
      setAppliedTree(tree)
      setLoadedPreset({ source: 'saved', name: presetName, baseline: tree })
    },
    [savedFilters, loadedPreset, handleReset]
  )

  const handleDeletePreset = useCallback(async (presetName: string) => {
    try {
      const configId = getConfigId()
      const config = await api.getConfig(configId)

      const updatedFilters = (config.metrics_filter || []).filter((f) => f.name !== presetName)

      await api.updateConfig(configId, {
        ...stripReadonlyFields(config),
        metrics_filter: updatedFilters,
      })

      setSavedFilters(updatedFilters)
      // If the deleted preset was the loaded one, drop provenance → "Custom filter".
      // The edited filterTree/appliedTree are intentionally kept (the query is still
      // valid; only its saved-preset identity is gone).
      setLoadedPreset((prev) =>
        prev?.source === 'saved' && prev.name === presetName ? null : prev
      )
      toast.success('Filter deleted')
    } catch (error) {
      console.error('Failed to delete filter:', error)
      toast.error('Failed to delete filter')
    }
  }, [])

  const getFilterRequest = useCallback((): ApiFilterRequest => {
    // The results reflect the APPLIED tree (hybrid apply). Exchanges are layered
    // on by the caller (Screener.tsx) as an outer AND, never inside the query.
    return mapTreeToApiFormat(appliedTree)
  }, [appliedTree])

  return {
    savedFilters,
    loadedPreset,
    isModified,
    filterTree,
    appliedTree,
    dirty,
    builderOpen,
    setFilterTree,
    selectBuiltIn,
    openBuilder,
    closeBuilder,
    applyBuilder,
    applyFilter,
    handleReset,
    savePreset,
    handleLoadPreset,
    handleDeletePreset,
    loadSavedFilters,
    getFilterRequest,
  }
}
