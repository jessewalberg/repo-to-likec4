import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** clsx + tailwind-merge: conditional classes with conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
