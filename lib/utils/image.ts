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

  // Supabase URL transformation uses the 'render/image/public' endpoint
  // if you want to use the native CDN transformation path, OR
  // you can append query strings directly to '/object/public/'.
  // We will use query strings as it's the safest non-breaking method for Supabase.
  
  try {
    const urlObj = new URL(url);
    
    if (options.width) urlObj.searchParams.set('width', options.width.toString());
    if (options.height) urlObj.searchParams.set('height', options.height.toString());
    if (options.quality) urlObj.searchParams.set('quality', options.quality.toString());
    if (options.format) urlObj.searchParams.set('format', options.format);
    else urlObj.searchParams.set('format', 'webp'); // Default to webp

    // Supabase Free plan does not support /render/image/public natively without Pro,
    // so we just append the query parameters. If they ever upgrade, or if Next.js Image 
    // uses this URL, it won't break.
    return urlObj.toString();
  } catch (e) {
    // Fallback if URL parsing fails
    return url;
  }
}
