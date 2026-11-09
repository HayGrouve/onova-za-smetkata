// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ConfirmActionProvider,
  useConfirmAction,
} from './confirm-action-provider.tsx'
import { getDeleteMyDataCopy } from '#/lib/destructive-action-copy.ts'

afterEach(cleanup)

const copy = getDeleteMyDataCopy()
const typed = copy.typedConfirmation!

function AskToDelete() {
  const { confirm } = useConfirmAction()
  const [result, setResult] = useState<string>('pending')
  return (
    <>
      <button
        type="button"
        onClick={async () => setResult(String(await confirm(copy)))}
      >
        open
      </button>
      <output>{result}</output>
    </>
  )
}

function renderAndOpen() {
  render(
    <ConfirmActionProvider>
      <AskToDelete />
    </ConfirmActionProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'open' }))
  return {
    field: screen.getByLabelText<HTMLInputElement>(typed.label),
    confirmButton: screen.getByRole<HTMLButtonElement>('button', {
      name: copy.confirmLabel,
    }),
  }
}

describe('typed confirmation', () => {
  it('keeps the button disabled until the field reads exactly the word', async () => {
    const { field, confirmButton } = renderAndOpen()
    expect(confirmButton.disabled).toBe(true)

    for (const attempt of ['изтрий', 'ИЗТРИ', ` ${typed.expected}`]) {
      fireEvent.change(field, { target: { value: attempt } })
      expect(confirmButton.disabled).toBe(true)
    }

    fireEvent.change(field, { target: { value: typed.expected } })
    expect(confirmButton.disabled).toBe(false)
    fireEvent.click(confirmButton)
    await screen.findByText('true')
  })

  it('starts empty again on the next open', async () => {
    const first = renderAndOpen()
    fireEvent.change(first.field, { target: { value: typed.expected } })
    fireEvent.click(screen.getByRole('button', { name: copy.cancelLabel }))
    await screen.findByText('false')

    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    expect(screen.getByLabelText<HTMLInputElement>(typed.label).value).toBe('')
    const confirmAgain = screen.getByRole<HTMLButtonElement>('button', {
      name: copy.confirmLabel,
    })
    expect(confirmAgain.disabled).toBe(true)
  })
})
