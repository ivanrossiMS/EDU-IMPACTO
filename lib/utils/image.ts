export interface OptimizeOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
}

/**
 * Appends Supabase Storage transformation parameters to a public URL.
 * Requires the Supabase project to support Image Transformations.
 * Safely ignores non-supabase URLs or returns the original if no options are provided.
 */
export function getOptimizedUrl(url: string | null | undefined, options: OptimizeOptions = {}): string {
  if (!url) return '';
  
  // Only apply transformations to Supabase storage URLs
  if (!url.includes('/storage/v1/object/public/')) {
    return url;
  }

  // Returning the original URL without query parameters.
  // Supabase Free plan does not support Image Transformations by default,
  // appending ?width=X&format=webp causes 400 Bad Request errors.
  return url;
}
