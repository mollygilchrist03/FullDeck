import type { ButtonHTMLAttributes } from 'react'

type Variant = 'accent' | 'gold' | 'ghost'
type Size = 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-wide ' +
  'transition-transform duration-100 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-felt-deep'

const variants: Record<Variant, string> = {
  accent: 'bg-casino text-card shadow-lg shadow-black/30 hover:brightness-110',
  gold: 'bg-gold text-ink shadow-lg shadow-black/30 hover:brightness-110',
  ghost: 'border border-gold/60 text-card hover:bg-white/5',
}

const sizes: Record<Size, string> = {
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-4 text-lg min-h-14',
}

export function Button({
  variant = 'accent',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    />
  )
}
