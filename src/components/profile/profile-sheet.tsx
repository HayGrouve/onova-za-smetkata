import { useAuth, useClerk } from '@clerk/tanstack-react-start'
import { SaveIcon, SparklesIcon, UserIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { formatUsernameError, parseUsername } from '#/lib/host-profile.ts'
import { useViewerNowMs } from '#/hooks/use-viewer-now-ms.ts'
import { api } from '../../../convex/_generated/api'

export interface ProfileSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatUsageLine(used: number, limit: number | null, noun: string) {
  if (limit === null) return `${noun}: неограничено`
  return `${noun}: ${used}/${limit} този месец`
}

export function ProfileSheet({ open, onOpenChange }: ProfileSheetProps) {
  const { isSignedIn } = useAuth()
  const { openUserProfile } = useClerk()
  const viewerNowMs = useViewerNowMs()
  const viewer = useQuery(
    api.users.viewer,
    open && isSignedIn ? { nowMs: viewerNowMs } : 'skip',
  )
  const saveUsername = useMutation(api.users.saveUsername)
  const [username, setUsername] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || viewer === undefined || viewer === null) return
    setFieldError(undefined)
    setUsername(viewer.username ?? '')
  }, [open, viewer])

  async function handleSave() {
    const parsed = parseUsername(username)
    if (!parsed.success) {
      setFieldError(formatUsernameError(parsed.error))
      return
    }

    setFieldError(undefined)
    setSaving(true)
    try {
      await saveUsername({ username: parsed.data })
      toast.success('Профилът е запазен')
      onOpenChange(false)
    } catch {
      toast.error('Неуспешно запазване')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserIcon className={ICON.section} aria-hidden />
            Профил
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          {viewer ? (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <p className="font-medium">
                План: {viewer.tier === 'pro' ? 'Pro' : 'Безплатен'}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>
                  {formatUsageLine(
                    viewer.billsUsedThisMonth,
                    viewer.billsLimit,
                    'Сметки',
                  )}
                </li>
                <li>
                  {formatUsageLine(
                    viewer.ocrUsedThisMonth,
                    viewer.ocrLimit,
                    'Сканирания',
                  )}
                </li>
                <li>
                  Групи: {viewer.friendGroupCount}/{viewer.friendGroupLimit}
                </li>
              </ul>
              <Button
                type="button"
                variant="outline"
                className="mt-3 h-10 w-full"
                onClick={() => openUserProfile()}
              >
                <SparklesIcon className={ICON.button} aria-hidden />
                Управление на абонамента
              </Button>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-username">Потребителско име</Label>
            <Input
              id="profile-username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                if (fieldError) setFieldError(undefined)
              }}
              placeholder="Как да те показваме на сметки"
              className="h-11"
              autoComplete="nickname"
              aria-invalid={Boolean(fieldError)}
            />
            {fieldError ? (
              <p className="text-xs text-destructive">{fieldError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                По избор. Празно поле изчиства името.
              </p>
            )}
          </div>
        </div>

        <SheetFooter className="border-t">
          <Button
            type="button"
            className="h-11 w-full"
            onClick={handleSave}
            disabled={saving || viewer === undefined}
          >
            <SaveIcon className={ICON.button} aria-hidden />
            Запази
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
