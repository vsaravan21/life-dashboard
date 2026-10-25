/**
 * Shrink a photo to at most `max` pixels on its longest side and re-encode
 * it as JPEG, so journal uploads stay small on slow phone connections.
 */
export async function shrinkPhoto(file: File, max = 1600, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b ?? file), "image/jpeg", quality));
}
