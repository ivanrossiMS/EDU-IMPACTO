import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export async function deleteStorageFilesByUrls(urls: string[]) {
  if (!urls || urls.length === 0) return;
  const supabase = await createProtectedClient();
  
  // Agrupar paths por bucket
  const bucketPaths: Record<string, string[]> = {};

  for (const url of urls) {
    if (!url) continue;
    // URL format expected: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path...]
    try {
      const parts = url.split('/storage/v1/object/public/');
      if (parts.length < 2) continue;
      
      const bucketAndPath = parts[1]; // e.g. "comunicados-midia/uploads/file.jpg"
      const slashIndex = bucketAndPath.indexOf('/');
      if (slashIndex === -1) continue;
      
      const bucket = bucketAndPath.substring(0, slashIndex);
      const path = bucketAndPath.substring(slashIndex + 1);
      
      if (!bucketPaths[bucket]) {
        bucketPaths[bucket] = [];
      }
      bucketPaths[bucket].push(path);
    } catch (err) {
      console.error('Error parsing storage URL', url, err);
    }
  }

  // Deletar para cada bucket
  for (const [bucket, paths] of Object.entries(bucketPaths)) {
    if (paths.length > 0) {
      const { error } = await supabase.storage.from(bucket).remove(paths);
      if (error) {
        console.error(`Error deleting from bucket ${bucket}:`, error.message);
      }
    }
  }
}
