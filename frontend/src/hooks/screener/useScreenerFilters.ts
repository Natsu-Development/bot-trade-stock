import { useState, useCallback, useEffect } from 'react'
import { api, getConfigId } from '@/lib/api'
import type { ScreenerFilterPreset } from '@/lib/api'
import { toast } from '@/components/ui/Toast'
import type { DynamicFilter, FilterField, FilterOperator } from '@/types'
import { mapFiltersToApiFormat } from '@/lib/screenerUtils'

const getDefaultFilters = (): DynamicFilter[] => [
  { id: '1', field: 'rs_52w', operator: '>=', value: 70 },
]

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2)

export interface UseScreenerFiltersResult {
  dynamicFilters: DynamicFilter[]
  filterLogic: 'and' | 'or'
  savedFilters: ScreenerFilterPreset[]
  selectedPreset: string | null
  showSaveFilterModal: boolean
  newFilterName: string
  setDynamicFilters: (filters: DynamicFilter[]) => void
  setFilterLogic: (logic: 'and' | 'or') => void
  setShowSaveFilterModal: (show: boolean) => void
  setNewFilterName: (name: string) => void
  handleReset: () => void
  handleSaveFilter: () => Promise<void>
  handleLoadPreset: (presetName: string) => void
  handleDeletePreset: (presetName: string) => Promise<void>
  loadSavedFilters: () => Promise<void>
  getFilterRequest: () => ReturnType<typeof mapFiltersToApiFormat>
}

export function useScreenerFilters(activeExchange: string): UseScreenerFiltersResult {
  const [dynamicFilters, setDynamicFilters] = useState<DynamicFilter[]>(getDefaultFilters)
  const [filterLogic, setFilterLogic] = useState<'and' | 'or'>('and')
  const [savedFilters, setSavedFilters] = useState<ScreenerFilterPreset[]>([])
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [showSaveFilterModal, setShowSaveFilterModal] = useState(false)
  const [newFilterName, setNewFilterName] = useState('')

  // Load saved filters on mount
  useEffect(() => {
    loadSavedFilters()
  }, [])

  const loadSavedFilters = useCallback(async () => {
    try {
      const configId = getConfigId()
      const config = await api.getConfig(configId)
      setSavedFilters(config.screener_filters || [])
    } catch (error) {
      console.error('Failed to load saved filters:', error)
    }
  }, [])

  const handleReset = useCallback(() => {
    setDynamicFilters(getDefaultFilters())
    setFilterLogic('and')
    setSelectedPreset(null)
  }, [])

  const handleSaveFilter = useCallback(async () => {
    if (!newFilterName.trim()) {
      toast.error('Please enter a filter name')
      return
    }

    try {
      const configId = getConfigId()
      const config = await api.getConfig(configId)

      const filterRequest = mapFiltersToApiFormat(dynamicFilters, filterLogic)
      const newPreset: ScreenerFilterPreset = {
        name: newFilterName,
        filters: filterRequest.filters || [],
        logic: filterLogic,
        exchanges: activeExchange !== 'All' ? [activeExchange] : undefined,
        created_at: new Date().toISOString(),
      }

      const existingIndex = (config.screener_filters || []).findIndex(f => f.name === newFilterName)

      let updatedFilters: ScreenerFilterPreset[]
      if (existingIndex >= 0) {
        updatedFilters = [...(config.screener_filters || [])]
        updatedFilters[existingIndex] = newPreset
        toast.success('Filter updated successfully')
      } else {
        updatedFilters = [...(config.screener_filters || []), newPreset]
        toast.success('Filter saved successfully')
      }

      await api.updateConfig(configId, {
        screener_filters: updatedFilters,
      })

      setSavedFilters(updatedFilters)
      setNewFilterName('')
      setShowSaveFilterModal(false)
    } catch (error) {
      console.error('Failed to save filter:', error)
      toast.error('Failed to save filter')
    }
  }, [dynamicFilters, filterLogic, activeExchange, newFilterName])

  const handleLoadPreset = useCallback((presetName: string) => {
    const preset = savedFilters.find(f => f.name === presetName)
    if (!preset) return

    setSelectedPreset(presetName)

    const loadedFilters: DynamicFilter[] = preset.filters.map((f, index) => ({
      id: generateId() + index,
      field: f.field as FilterField,
      operator: f.op as FilterOperator,
      value: f.value,
    }))

    setDynamicFilters(loadedFilters.length > 0 ? loadedFilters : getDefaultFilters())
    setFilterLogic(preset.logic)
  }, [savedFilters])

  const handleDeletePreset = useCallback(async (presetName: string) => {
    try {
      const configId = getConfigId()
      const config = await api.getConfig(configId)

      const updatedFilters = (config.screener_filters || []).filter(f => f.name !== presetName)

      await api.updateConfig(configId, {
        screener_filters: updatedFilters,
      })

      setSavedFilters(updatedFilters)
      if (selectedPreset === presetName) {
        setSelectedPreset(null)
      }
      toast.success('Filter deleted')
    } catch (error) {
      console.error('Failed to delete filter:', error)
      toast.error('Failed to delete filter')
    }
  }, [selectedPreset])

  const getFilterRequest = useCallback(() => {
    return mapFiltersToApiFormat(dynamicFilters, filterLogic)
  }, [dynamicFilters, filterLogic])

  return {
    dynamicFilters,
    filterLogic,
    savedFilters,
    selectedPreset,
    showSaveFilterModal,
    newFilterName,
    setDynamicFilters,
    setFilterLogic,
    setShowSaveFilterModal,
    setNewFilterName,
    handleReset,
    handleSaveFilter,
    handleLoadPreset,
    handleDeletePreset,
    loadSavedFilters,
    getFilterRequest,
  }
}
