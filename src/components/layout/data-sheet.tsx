import { DatabaseIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { useMutation } from 'convex/react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import { ICON } from '#/lib/app-icons.ts'
import {
  DELETE_MY_DATA_COPY,
  getDeleteMyDataCopy,
} from '#/lib/destructive-action-copy.ts'
import { focusContentInsteadOfField } from '#/lib/dialog-focus.ts'
import { HUB_AKAUNT_URL, HUB_PRIVACY_URL } from '#/lib/hub-links.ts'
import { api } from '../../../convex/_generated/api'

export interface DataSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Данни: Изтрий данните wipes what Сметката holds about the Host. The Акаунт
 * itself is deleted only on the hub's `/akaunt`.
 */
export function DataSheet({ open, onOpenChange }: DataSheetProps) {
  const { confirm } = useConfirmAction()
  const deleteMyData = useMutation(api.accountDeletion.deleteMyData)
  const ensureCurrent = useMutation(api.users.ensureCurrent)
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!(await confirm(getDeleteMyDataCopy()))) return
    setDeleting(true)
    try {
      await deleteMyData({})
      // The old users row is gone; start the brand new Host right away.
      await ensureCurrent({})
      onOpenChange(false)
      toast.success(DELETE_MY_DATA_COPY.done)
      await navigate({ to: '/' })
    } catch {
      toast.error(DELETE_MY_DATA_COPY.failed)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-xl"
        onOpenAutoFocus={focusContentInsteadOfField}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <DatabaseIcon className={ICON.section} aria-hidden />
            {DELETE_MY_DATA_COPY.title}
          </SheetTitle>
          <SheetDescription>{DELETE_MY_DATA_COPY.body}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2 px-4 text-sm text-muted-foreground">
          <p>
            {DELETE_MY_DATA_COPY.akauntQuestion}{' '}
            <a
              href={HUB_AKAUNT_URL}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {DELETE_MY_DATA_COPY.akauntLink}
            </a>
            .
          </p>
          <p>
            <a href={HUB_PRIVACY_URL} className="underline underline-offset-4">
              {DELETE_MY_DATA_COPY.privacyLink}
            </a>
          </p>
        </div>

        <SheetFooter className="border-t">
          <Button
            type="button"
            variant="destructive"
            className="h-11 w-full"
            onClick={handleDelete}
            disabled={deleting}
            aria-busy={deleting}
          >
            <Trash2Icon className={ICON.button} aria-hidden />
            {DELETE_MY_DATA_COPY.button}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
