import { useState } from 'react'
import { ChevronDown, ChevronUp, FileText } from 'lucide-react'

import type { SourceCitation } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

export function SourcesList({ sources }: { sources: SourceCitation[] }) {
  const [open, setOpen] = useState(false)

  if (sources.length === 0) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2 w-full max-w-md">
      <CollapsibleTrigger
        render={
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
            <FileText className="size-3.5" />
            {sources.length} source{sources.length === 1 ? '' : 's'}
            {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </Button>
        }
      />
      <CollapsibleContent className="mt-2 flex flex-col gap-2">
        {sources.map((source, index) => (
          <div key={source.chunk_id} className="border-border bg-muted/40 rounded-md border p-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                [{index + 1}] {source.source}
                {source.page != null && `, page ${source.page}`}
                {source.paragraph != null && `, paragraph ${source.paragraph}`}
              </span>
              <span className="text-muted-foreground shrink-0">{Math.round(source.relevance * 100)}%</span>
            </div>
            <p className="text-muted-foreground mt-1 line-clamp-2">{source.preview}</p>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
