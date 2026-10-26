/** Photos and videos share one list of refs; a ref's file extension says which it is. */
const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-m4v": "m4v",
};
export const extFor = (type: string) => EXT[type] ?? (type.startsWith("video/") ? "mp4" : "jpg");
export const isVideoRef = (ref: string) => /\.(mp4|mov|webm|m4v)$/i.test(ref);
export const isVideoFile = (f: File) => f.type.startsWith("video/");
/** Supabase's free plan stores files up to 50 MB, so videos stay under that to sync. */
export const MAX_VIDEO_MB = 50;
