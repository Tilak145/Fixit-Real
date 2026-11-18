import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// React Native loads one font file per weight, so in this app font-medium,
// font-semibold and font-bold select a Geist family (global.css). They merge
// with font-sans as one group: the last one written wins.
const WEIGHT_FAMILIES = ['sans', 'normal', 'medium', 'semibold', 'bold'];
const twMerge = extendTailwindMerge({
  override: { classGroups: { 'font-weight': [{ font: ['thin', 'extralight', 'light', 'extrabold', 'black'] }] } },
  extend: { classGroups: { 'font-family': [{ font: WEIGHT_FAMILIES }] } },
});

export function cn(...values: ClassValue[]) { return twMerge(clsx(values)); }
