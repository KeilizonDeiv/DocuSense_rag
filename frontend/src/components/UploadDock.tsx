import { useCallback, useState } from 'react'
import { AlertCircle, FileText, Upload, X } from 'lucide-react'

import { ApiError, uploadDocument } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface UploadItem {
  id: string
  name: string
  progress: number
  status: 'uploading' | 'done' | 'error'
  error?: string
}

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md']

export function UploadDock({ onUploaded }: { onUploaded: () => void }) {
  const [items, setItems] = useState<UploadItem[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const uploadFiles = useCallback(
    (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        const id = crypto.randomUUID()
        setItems((prev) => [...prev, { id, name: file.name, progress: 0, status: 'uploading' }])

        uploadDocument(file, (fraction) => {
          setItems((prev) => prev.map((item) => (item.id === id ? { ...item, progress: fraction } : item)))
        })
          .then(() => {
            setItems((prev) => prev.map((item) => (item.id === id ? { ...item, progress: 1, status: 'done' } : item)))
            onUploaded()
          })
          .catch((err: unknown) => {
            const message = err instanceof ApiError ? err.message : 'Upload failed - please try again'
            setItems((prev) =>
              prev.map((item) => (item.id === id ? { ...item, status: 'error', error: message } : item)),
            )
          })
      }
    },
    [onUploaded],
  )

  return (
    <div className="flex flex-col gap-3">
      <label
        className={cn(
          'border-border hover:border-primary/50 hover:bg-muted/50 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
          isDragging && 'border-primary bg-muted/50',
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files)
        }}
      >
        <Upload className="text-muted-foreground size-6" />
        <div className="text-sm">
          <span className="text-primary font-medium">Click to upload</span> or drag and drop
        </div>
        <p className="text-muted-foreground text-xs">PDF, DOCX, TXT, or MD - up to 10MB each</p>
        <input
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) uploadFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </label>

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-xs">
              {item.status === 'error' ? (
                <AlertCircle className="text-destructive size-4 shrink-0" />
              ) : (
                <FileText className="text-muted-foreground size-4 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate">{item.name}</div>
                {item.status === 'uploading' && <Progress value={item.progress * 100} className="mt-1" />}
                {item.status === 'error' && <div className="text-destructive mt-0.5">{item.error}</div>}
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0"
                aria-label="Dismiss"
                onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
