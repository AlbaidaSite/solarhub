import { supabase } from './client';

const DEFAULT_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? 'solarhub-assets';

export function getStorageUrl(path: string, bucket: string = DEFAULT_BUCKET): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}