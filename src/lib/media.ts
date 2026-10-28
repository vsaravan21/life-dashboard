/** Photos and videos share one list of refs; a ref's file extension says which it is. */
const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-m4v": "m4v",
};
/** A file's extension for storage: known photo and video types first, then the file's own name (for documents), else jpg for older photo blobs. */
export const extFor = (type: string, name = "") => {
  if (EXT[type]) return EXT[type];
  if (type.startsWith("video/")) return "mp4";
  if (type.startsWith("image/") || !name) return "jpg";
  const ext = name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6);
  return ext && ext !== name.toLowerCase() ? ext : "bin";
};
export const isImageFile = (f: File) => f.type.startsWith("image/");
/** The most any single file can be, so it can sync on Supabase's free plan. */
export const MAX_FILE_MB = 50;
export const isVideoRef = (ref: string) => /\.(mp4|mov|webm|m4v)$/i.test(ref);
export const isVideoFile = (f: File) => f.type.startsWith("video/");
/** Supabase's free plan stores files up to 50 MB, so videos stay under that to sync. */
export const MAX_VIDEO_MB = 50;
