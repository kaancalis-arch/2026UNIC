import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTitleCase(text: string): string {
    if (!text) return text;
  
    const exceptions = ["ve", "ile", "için", "veya"];
    
    return text
      .toLocaleLowerCase('tr-TR')
      .split(' ')
      .map((word, index) => {
        if (!word) return word;
        if (exceptions.includes(word) && index !== 0) {
          return word;
        }
        return word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1);
      })
      .join(' ');
}
