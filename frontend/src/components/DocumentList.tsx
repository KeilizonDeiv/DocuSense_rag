import { FileText, Trash2 } from 'lucide-react'

import type { VectorStoreStats } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function DocumentList({
  stats,
  onDelete,
  onClearAll,
}: {
  stats: VectorStoreStats | null
  onDelete: (source: string) => void
  onClearAll: () => void
}) {
  const sources = stats?.sources ?? []

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-muted/40 grid grid-cols-2 gap-3 rounded-lg p-3 text-center">
        <div>
          <div className="text-lg font-semibold">{stats?.unique_sources ?? 0}</div>
          <div className="text-muted-foreground text-xs">Documents</div>
        </div>
        <div>
          <div className="text-lg font-semibold">{stats?.total_chunks ?? 0}</div>
          <div className="text-muted-foreground text-xs">Chunks indexed</div>
        </div>
      </div>

      {sources.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-xs">No documents yet - upload one to get started.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {sources.map((source) => (
            <li key={source} className="group hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
              <FileText className="text-muted-foreground size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{source}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground opacity-0 group-hover:opacity-100"
                aria-label={`Delete ${source}`}
                onClick={() => onDelete(source)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {sources.length > 0 && (
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="outline" size="sm">
                Clear all documents
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all documents?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes every uploaded document and your conversation history for this session. This can't be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={onClearAll}>
                Clear all
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
