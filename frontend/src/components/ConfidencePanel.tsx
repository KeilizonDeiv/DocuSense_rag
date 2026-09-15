import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

import type { AnswerQuality } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

const CONFIDENCE_STYLES: Record<AnswerQuality['confidence'], string> = {
  high: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  low: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
}

const CONFIDENCE_LABELS: Record<AnswerQuality['confidence'], string> = {
  high: 'Strong match',
  medium: 'Moderate match',
  low: 'Weak match',
}

export interface ConfidencePanelProps {
  quality: AnswerQuality
  generationMs?: number | null
  sourceCount: number
}

/** The "is the RAG reading this well" report for one answer: a plain-language
 * badge + explanation up front, with the underlying numbers one click away
 * for anyone who wants them - not a wall of scores by default. */
export function ConfidencePanel({ quality, generationMs, sourceCount }: ConfidencePanelProps) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2 w-full max-w-md">
      <div className="flex items-start gap-2">
        <Badge variant="outline" className={cn('mt-0.5 shrink-0', CONFIDENCE_STYLES[quality.confidence])}>
          {CONFIDENCE_LABELS[quality.confidence]}
        </Badge>
        <p className="text-muted-foreground flex-1 text-xs leading-relaxed">{quality.explanation}</p>
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground shrink-0"
              aria-label={open ? 'Hide quality details' : 'Show quality details'}
            >
              {open ? <ChevronUp /> : <ChevronDown />}
            </Button>
          }
        />
      </div>
      <CollapsibleContent className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-4 gap-y-1 pl-0.5 text-xs">
        <span>Confidence score: {Math.round(quality.confidence_score * 100)}%</span>
        <span>Sources used: {sourceCount}</span>
        <span>Retrieval: {quality.retrieval_ms}ms</span>
        {generationMs != null && <span>Generation: {generationMs}ms</span>}
      </CollapsibleContent>
    </Collapsible>
  )
}
