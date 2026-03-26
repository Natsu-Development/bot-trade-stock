import { useState, useCallback, useEffect } from 'react'
import { api, getConfigId, type ApiTradingConfig } from '@/lib/api'
import type { ScreenerFilterPreset } from '@/lib/api'
import { toast } from '@/components/ui/Toast'
import type { DynamicFilter, FilterField, FilterOperator } from '@/types'
import { mapFiltersToApiFormat } from '@/lib/screenerUtils'
import { generateId } from '@/lib/id'

const getDefaultFilters = (): DynamicFilter[] => [
  { id: '1', field: 'rs_52w', operator: '>=', value: 70 },
]

function stripReadonlyFields(config: ApiTradingConfig): Omit<ApiTradingConfig, 'created_at' | 'updated_at'> {
  const { created_at: _, updated_at: __, ...rest } = config
  return rest
}

export interface UseScreenerFiltersResult {
  dynamicFilters: DynamicFilter[]
  filterLogic: 'and' | 'or'
  savedFilters: ScreenerFilterPreset[]
  selectedPreset: string | null
  showSaveFilterModal: boolean
  setDynamicFilters: (filters: DynamicFilter[]) => void
  setFilterLogic: (logic: 'and' | 'or') => void
  setShowSaveFilterModal: (show: boolean) => void
  handleReset: () => void
  handleSaveFilter: (name: string) => Promise<void>
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

  const handleReset = useCallback(() => {
    setDynamicFilters(getDefaultFilters())
    setFilterLogic('and')
    setSelectedPreset(null)
  }, [])

  const handleSaveFilter = useCallback(async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Please enter a filter name')
      return
    }

    try {
      const configId = getConfigId()
      const config = await api.getConfig(configId)

      const filterRequest = mapFiltersToApiFormat(dynamicFilters, filterLogic)
      const newPreset: ScreenerFilterPreset = {
        name: trimmed,
        filters: filterRequest.filters || [],
        logic: filterLogic,
        exchanges: activeExchange !== 'All' ? [activeExchange] : undefined,
        created_at: new Date().toISOString(),
      }

      const currentFilters = config.metrics_filter || []
      const existingIndex = currentFilters.findIndex(f => f.name === trimmed)

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
      setShowSaveFilterModal(false)
    } catch (error) {
      console.error('Failed to save filter:', error)
      toast.error('Failed to save filter')
    }
  }, [dynamicFilters, filterLogic, activeExchange])

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

      const updatedFilters = (config.metrics_filter || []).filter(f => f.name !== presetName)

      await api.updateConfig(configId, {
        ...stripReadonlyFields(config),
        metrics_filter: updatedFilters,
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
    setDynamicFilters,
    setFilterLogic,
    setShowSaveFilterModal,
    handleReset,
    handleSaveFilter,
    handleLoadPreset,
    handleDeletePreset,
    loadSavedFilters,
    getFilterRequest,
  }
}
