import { ChevronDown } from 'lucide-react'
import { Button } from 'counterfoil-starter-kit'
import Dropdown from './Dropdown'
import { LANGUAGE_OPTIONS } from '../utils/languages'

type TopBarProps = {
  isUploading: boolean
  onImport: () => void
  onUndo: () => void
  canUndo: boolean
  queueOpen: boolean
  onToggleQueue: () => void
  endnotesOpen: boolean
  onToggleEndnotes: () => void
  showDebug: boolean
  onToggleDebug: () => void
  showComponents: boolean
  onToggleComponents: () => void
  onShowHistory: () => void
  onShowProgressBox: () => void
  workingFiles: string[]
  workingFileTitles: Record<string, string>
  selectedWorkingFile: string
  onWorkingFileSelect: (filename: string) => void
  viewerLanguage: string
  onViewerLanguageChange: (language: string) => void
  onExecuteQueue: () => void
  canExecute: boolean
  queueCount: number
  spellcheckEnabled: boolean
  onToggleSpellcheck: () => void
  onShowDictionary: () => void
}

export default function TopBar({
  isUploading,
  onImport,
  onUndo,
  canUndo,
  queueOpen,
  onToggleQueue,
  endnotesOpen,
  onToggleEndnotes,
  showDebug,
  onToggleDebug,
  showComponents,
  onToggleComponents,
  onShowHistory,
  onShowProgressBox,
  workingFiles,
  workingFileTitles,
  selectedWorkingFile,
  onWorkingFileSelect,
  viewerLanguage,
  onViewerLanguageChange,
  onExecuteQueue,
  canExecute,
  queueCount,
  spellcheckEnabled,
  onToggleSpellcheck,
  onShowDictionary,
}: TopBarProps) {
  const fileLabel = selectedWorkingFile
    ? workingFileTitles[selectedWorkingFile] ||
      selectedWorkingFile.replace(/\.epub$/i, '')
    : 'Select working file…'
  return (
    <header
      className="border-b border-slate-200 bg-white h-20"
      data-component="TopBar"
    >
      <div className="mx-auto grid h-20 max-w-7xl grid-cols-3 items-center gap-4 px-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            EasyPub
          </p>
        </div>
        <div className="flex justify-center">
          <Dropdown
            variant="text"
            label={fileLabel}
            showIconRight
            iconRight={<ChevronDown />}
            items={workingFiles.map((file) => ({
              id: file,
              label: workingFileTitles[file] || file.replace(/\.epub$/i, ''),
              onSelect: () => onWorkingFileSelect(file),
            }))}
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span className="text-slate-500">Language</span>
            <select
              value={viewerLanguage}
              onChange={(event) => onViewerLanguageChange(event.target.value)}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600"
              aria-label="Hyphenation language"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={spellcheckEnabled}
              onChange={onToggleSpellcheck}
              className="accent-blue-500"
            />
            <span className="text-slate-500">Spellcheck</span>
          </label>
          <Button variant="secondary" onClick={onShowDictionary}>
            Dictionary
          </Button>
          <Button variant="secondary" onClick={onToggleEndnotes}>
            {endnotesOpen ? 'Hide Endnotes' : 'Endnotes'}
          </Button>
          <Button variant="primary" onClick={onExecuteQueue} disabled={!canExecute}>
            Update Epub
          </Button>
          <Dropdown
            variant="button"
            showText={false}
            showIconRight
            iconRight={<ChevronDown />}
            items={[
              {
                id: 'history',
                label: 'File History',
                onSelect: onShowHistory,
              },
              {
                id: 'components',
                label: showComponents ? 'Hide Components' : 'Show Components',
                onSelect: onToggleComponents,
              },
              {
                id: 'import',
                label: isUploading ? 'Importing…' : 'Import Epub',
                onSelect: onImport,
              },
              {
                id: 'undo',
                label: 'Undo',
                onSelect: onUndo,
                disabled: !canUndo,
              },
              {
                id: 'queue',
                label: queueOpen ? 'Hide Queue' : 'Show Queue',
                onSelect: onToggleQueue,
              },
              {
                id: 'debug',
                label: showDebug ? 'Hide Debug' : 'Show Debug',
                onSelect: onToggleDebug,
              },
              {
                id: 'progress',
                label: 'Show ProgressBox',
                onSelect: onShowProgressBox,
              },
            ]}
          />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-6 pb-4 text-xs text-slate-500">
        {queueCount ? `${queueCount} queued` : ''}
      </div>
    </header>
  )
}
