/** PROTOTYPE — Direction A „Хора“: invite link, people with joined state, quick-add friends. */
import { useState } from 'react'
import {
  CheckIcon,
  CopyIcon,
  LinkIcon,
  PlusIcon,
  Share2Icon,
  Trash2Icon,
  UserPlusIcon,
} from 'lucide-react'
import { RECENT_FRIENDS } from '../../mock/data.ts'
import { useProto } from '../../mock/store.tsx'
import {
  Avatar,
  Btn,
  Chip,
  Field,
  Group,
  GroupLabel,
  Money,
  RowMenu,
  STROKE,
  TextInput,
  copyText,
  useFlash,
} from '../ui.tsx'
import { billLink } from './shared.tsx'

export function PeopleTab({ locked }: { locked: boolean }) {
  const { derived, dispatch } = useProto()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const names = new Set(
    derived.seats.map((s) => s.name.toLocaleLowerCase('bg')),
  )
  const suggestions = RECENT_FRIENDS.filter(
    (f) => !names.has(f.toLocaleLowerCase('bg')),
  )
  const onlyHost = derived.guests.length === 0

  function add(raw: string) {
    const n = raw.trim()
    if (!n) return setError('Въведете име')
    if (names.has(n.toLocaleLowerCase('bg')))
      return setError(`${n} вече е в сметката`)
    dispatch({ type: 'addParticipant', name: n })
    setName('')
    setError(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <InviteCard empty={onlyHost} />

      {!locked && (
        <section>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              add(name)
            }}
          >
            <Field label="Добави човек" htmlFor="a-add-person" error={error}>
              <div className="flex gap-2">
                <TextInput
                  id="a-add-person"
                  value={name}
                  invalid={!!error}
                  placeholder="Име"
                  autoComplete="off"
                  onChange={(e) => {
                    setName(e.target.value)
                    setError(null)
                  }}
                />
                <Btn
                  type="submit"
                  size="lg"
                  variant="secondary"
                  aria-label="Добави"
                  className="h-11 px-3.5"
                >
                  <PlusIcon strokeWidth={STROKE} />
                </Btn>
              </div>
            </Field>
          </form>
          {suggestions.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-[13px] text-(--a-muted)">
                Делили сте с тях
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((f) => (
                  <Chip key={f} onClick={() => add(f)}>
                    <PlusIcon strokeWidth={STROKE} />
                    {f}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section>
        <GroupLabel>
          {derived.seats.length === 1
            ? 'Само вие'
            : `${derived.seats.length} души на масата`}
        </GroupLabel>
        <Group>
          {derived.seats.map((s) => (
            <div
              key={s.participantId}
              className="flex items-center gap-3 px-4 py-3"
            >
              <Avatar name={s.name} me={s.isHost} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">
                  {s.name}
                  {s.isHost && (
                    <span className="font-normal text-(--a-muted)"> (вие)</span>
                  )}
                </p>
                <p className="flex items-center gap-1.5 text-[13px] text-(--a-muted)">
                  {s.isHost ? (
                    'Домакин'
                  ) : s.joined ? (
                    <>
                      <span
                        className="size-1.5 rounded-full bg-(--a-paid)"
                        aria-hidden
                      />
                      В сметката
                    </>
                  ) : (
                    'Линкът не е отворен'
                  )}
                </p>
              </div>
              <div className="text-right">
                <Money
                  cents={s.totals.owedCents}
                  className="text-[15px] font-semibold"
                />
                <p className="text-[13px] text-(--a-muted) tabular-nums">
                  {s.claimedUnits === 1
                    ? '1 бройка'
                    : `${s.claimedUnits} бройки`}
                </p>
              </div>
              {!s.isHost && !locked && (
                <RowMenu
                  label={`Още за ${s.name}`}
                  items={[
                    {
                      label: 'Премахни от сметката',
                      danger: true,
                      icon: <Trash2Icon strokeWidth={STROKE} />,
                      onSelect: () =>
                        dispatch({
                          type: 'removeParticipant',
                          participantId: s.participantId,
                        }),
                    },
                  ]}
                />
              )}
            </div>
          ))}
        </Group>
        {onlyHost && (
          <p className="mt-3 flex items-center gap-2 px-1 text-[13px] text-(--a-muted)">
            <UserPlusIcon strokeWidth={STROKE} className="size-4" />
            Добавете хората от масата. Те ще изберат името си от линка.
          </p>
        )}
      </section>
    </div>
  )
}

export function InviteCard({ empty }: { empty?: boolean }) {
  const [flashKey, flash] = useFlash()
  const { derived } = useProto()
  const link = billLink(derived.bill._id)
  const joined = derived.guests.filter((g) => g.joined).length
  return (
    <div className="rounded-[14px] border border-(--a-hairline) bg-(--a-surface) p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-(--a-accent-soft) text-(--a-accent)">
          <LinkIcon strokeWidth={STROKE} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Линк за масата</p>
          <p className="text-[13px] text-(--a-muted)">
            {empty
              ? 'Пратете го в групата. Всеки избира името си и отбелязва какво е ял.'
              : `${joined} от ${derived.guests.length} отвориха линка`}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-[10px] bg-(--a-surface-2) py-1 pr-1 pl-3">
        <span className="a-mono min-w-0 flex-1 truncate text-[13px]">
          {link}
        </span>
        <Btn
          size="sm"
          variant="quiet"
          className="bg-(--a-surface)"
          onClick={() => {
            copyText(`https://${link}`)
            flash('copy')
          }}
        >
          {flashKey === 'copy' ? (
            <CheckIcon strokeWidth={2} />
          ) : (
            <CopyIcon strokeWidth={STROKE} />
          )}
          {flashKey === 'copy' ? 'Копирано' : 'Копирай'}
        </Btn>
      </div>
      <Btn
        size="md"
        className="mt-2 w-full"
        onClick={() => {
          const data = { title: 'Онова за сметката', url: `https://${link}` }
          if (typeof navigator.share === 'function')
            void navigator.share(data).catch(() => {})
          else {
            copyText(data.url)
            flash('copy')
          }
        }}
      >
        <Share2Icon strokeWidth={STROKE} />
        Сподели в групата
      </Btn>
    </div>
  )
}
