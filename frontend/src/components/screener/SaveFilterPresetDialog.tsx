import { memo, useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogIcon, DialogTitle } from '@/components/ui/dialog'
import { Icons } from '../icons/Icons'

export interface SaveFilterPresetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (name: string) => void | Promise<void>
}

/**
 * Isolated dialog so filter name typing only re-renders this subtree,
 * not the full Screener page (large results table).
 */
export const SaveFilterPresetDialog = memo(function SaveFilterPresetDialog({
  open,
  onOpenChange,
  onSave,
}: SaveFilterPresetDialogProps) {
  const [filterName, setFilterName] = useState('')

  useEffect(() => {
    if (open) {
      setFilterName('')
    }
  }, [open])

  const handleSubmit = useCallback(() => {
    void onSave(filterName)
  }, [filterName, onSave])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="md"
        aria-describedby={undefined}
        overlayClassName="backdrop-blur-none"
      >
        <DialogHeader>
          <DialogIcon><Icons.Save /></DialogIcon>
          <DialogTitle>Save Filter Preset</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="mb-4">
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
              Filter Name
            </label>
            <input
              type="text"
              className="flex h-10 w-full rounded-md border border-[var(--border-dim)] bg-[var(--bg-elevated)] px-4 py-2 text-sm text-[var(--text-primary)] font-mono shadow-sm transition-colors placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:border-[var(--neon-cyan)] focus-visible:ring-[3px] focus-visible:ring-[var(--neon-cyan-dim)]"
              placeholder="e.g., High RS Stocks (80+)"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              This will save your current filter conditions and logic for quick access later.
            </p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            <span>Cancel</span>
          </Button>
          <Button icon="Save" onClick={handleSubmit}>
            <span>Save Filter</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
