import * as React from 'react'

import { cn } from '#/lib/utils.ts'

function Input({
  className,
  type,
  ref,
  ...props
}: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      ref={ref}
      data-slot="input"
      className={cn(
        // Printed field: an ink underline on paper, no box.
        'min-h-11 w-full min-w-0 rounded-none border-0 border-b-2 border-foreground bg-transparent px-0.5 py-1.5 text-base transition-[border-color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-[13px]',
        'focus-visible:border-stamp focus-visible:shadow-[0_2px_0_0_var(--stamp)] focus-visible:outline-none',
        'aria-invalid:border-dashed aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
