import * as React from 'react'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '#/lib/utils.ts'

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full text-[13px] font-semibold whitespace-nowrap transition-[transform,filter,background-color,color] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-stamp disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:ring-2 aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 active:translate-y-px active:scale-[0.98]",
  {
    variants: {
      variant: {
        /* Vermilion: the one primary action on a surface. */
        default:
          'bg-primary font-display font-bold text-primary-foreground hover:brightness-105',
        destructive:
          'bg-destructive font-display font-bold text-destructive-foreground hover:brightness-105',
        /* Ghost pill outlined in the current text colour. */
        outline:
          'border-[1.5px] border-current bg-transparent hover:bg-foreground/[0.06]',
        /* Ink: a secondary action with weight. */
        secondary: 'bg-foreground text-background hover:brightness-110',
        ghost: 'hover:bg-foreground/[0.06]',
        link: 'rounded-none text-foreground underline decoration-dotted decoration-2 underline-offset-4 hover:decoration-solid',
      },
      size: {
        default: 'min-h-11 px-5 has-[>svg]:px-4',
        xs: "min-h-7 gap-1 px-2.5 text-[11px] has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3",
        sm: 'min-h-9 gap-1.5 px-3.5 text-[12px] has-[>svg]:px-3',
        lg: 'min-h-12 px-6 has-[>svg]:px-5',
        icon: 'size-11',
        'icon-xs': "size-7 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-9',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
