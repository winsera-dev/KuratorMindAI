import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS classes with clsx and tailwind-merge.
 * This ensures that conflicting classes (like multiple bg-* colors)
 * are resolved correctly, which is essential for maintaining solid UI surfaces.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
