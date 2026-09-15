import { Download, LibraryBig, Moon, MoreVertical, Sun, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function TopBar({
  hasApi,
  isDark,
  onToggleDark,
  averageConfidence,
  onOpenLibrary,
  hasMessages,
  onExportConversation,
  onClearConversation,
}: {
  hasApi: boolean | null
  isDark: boolean
  onToggleDark: () => void
  averageConfidence: number | null
  onOpenLibrary: () => void
  hasMessages: boolean
  onExportConversation: () => void
  onClearConversation: () => void
}) {
  return (
    <header className="border-border flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-6">
      <div>
        <h1 className="text-lg font-semibold">DocuSense</h1>
        <p className="text-muted-foreground text-xs">Ask questions about your documents</p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Document library"
          onClick={onOpenLibrary}
          className="lg:hidden"
        >
          <LibraryBig />
        </Button>
        {averageConfidence != null && (
          <Badge variant="outline" className="text-muted-foreground hidden sm:inline-flex">
            Avg. confidence {Math.round(averageConfidence * 100)}%
          </Badge>
        )}
        {hasApi != null && (
          <Badge
            variant="outline"
            className={
              hasApi
                ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400'
            }
          >
            {hasApi ? 'Live' : 'Demo mode'}
          </Badge>
        )}
        <Button variant="ghost" size="icon" aria-label="Toggle dark mode" onClick={onToggleDark}>
          {isDark ? <Sun /> : <Moon />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="More options">
                <MoreVertical />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={!hasMessages} onClick={onExportConversation}>
              <Download />
              Export conversation
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" disabled={!hasMessages} onClick={onClearConversation}>
              <Trash2 />
              Clear conversation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
