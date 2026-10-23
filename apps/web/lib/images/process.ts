export async function processImageForUpload(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('FILE_TOO_LARGE');
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('INVALID_FILE');
  }

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    throw new Error('INVALID_FILE');
  }

  let width = bitmap.width;
  let height = bitmap.height;
  const maxSide = 2000;
  if (width > maxSide || height > maxSide) {
    if (width >= height) {
      height = Math.round((height / width) * maxSide);
      width = maxSide;
    } else {
      width = Math.round((width / height) * maxSide);
      height = maxSide;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('INVALID_FILE');
  ctx.drawImage(bitmap, 0, 0, width, height);

  let blob: Blob | null = null;
  try {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/webp', 0.82),
    );
  } catch {
    blob = null;
  }
  if (!blob) {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85),
    );
  }
  if (!blob) throw new Error('INVALID_FILE');
  if (blob.size > 5 * 1024 * 1024) {
    const previousType = blob.type;
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), previousType === 'image/webp' ? 'image/webp' : 'image/jpeg', 0.7),
    );
  }
  if (!blob || blob.size > 5 * 1024 * 1024) {
    throw new Error('TOO_LARGE_AFTER_PROCESSING');
  }
  return { blob, width, height };
}
