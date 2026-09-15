import type { VectorStoreStats } from '@/lib/api'
import { DocumentList } from './DocumentList'
import { UploadDock } from './UploadDock'

export function DocumentLibrary({
  stats,
  onUploaded,
  onDelete,
  onClearAll,
}: {
  stats: VectorStoreStats | null
  onUploaded: () => void
  onDelete: (source: string) => void
  onClearAll: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="mb-2 text-sm font-medium">Document library</h2>
        <UploadDock onUploaded={onUploaded} />
      </div>
      <DocumentList stats={stats} onDelete={onDelete} onClearAll={onClearAll} />
    </div>
  )
}
