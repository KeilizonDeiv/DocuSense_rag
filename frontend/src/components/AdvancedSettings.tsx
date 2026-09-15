import { Settings2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'

export interface QuerySettings {
  nResults: number
  useReranking: boolean
  useContext: boolean
}

export const DEFAULT_QUERY_SETTINGS: QuerySettings = {
  nResults: 5,
  useReranking: true,
  useContext: true,
}

/** Technical retrieval knobs, tucked behind a popover rather than shown on
 * the main screen - the default view should read as "upload, ask, get an
 * answer", not require understanding what reranking or context window
 * means. */
export function AdvancedSettings({
  settings,
  onChange,
}: {
  settings: QuerySettings
  onChange: (settings: QuerySettings) => void
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Advanced settings">
            <Settings2 />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80">
        <div className="flex flex-col gap-4 p-1">
          <div>
            <h4 className="text-sm font-medium">Advanced settings</h4>
            <p className="text-muted-foreground text-xs">
              These affect how answers are found - the defaults work well for most questions.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="reranking-switch">Prioritize best matches</Label>
              <p className="text-muted-foreground text-xs">Double-checks results for relevance before answering.</p>
            </div>
            <Switch
              id="reranking-switch"
              checked={settings.useReranking}
              onCheckedChange={(checked) => onChange({ ...settings, useReranking: checked })}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="context-switch">Remember conversation</Label>
              <p className="text-muted-foreground text-xs">Uses earlier questions to understand follow-ups.</p>
            </div>
            <Switch
              id="context-switch"
              checked={settings.useContext}
              onCheckedChange={(checked) => onChange({ ...settings, useContext: checked })}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="results-slider">Sources to consider</Label>
              <span className="text-muted-foreground text-xs">{settings.nResults}</span>
            </div>
            <Slider
              id="results-slider"
              className="mt-2"
              min={3}
              max={10}
              step={1}
              value={[settings.nResults]}
              onValueChange={(value) =>
                onChange({ ...settings, nResults: Array.isArray(value) ? value[0] : value })
              }
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
