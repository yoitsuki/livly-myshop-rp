import exifr from "exifr";

/**
 * Try to read EXIF DateTimeOriginal as epoch ms.
 * Falls back to the file's lastModified, or Date.now() for a Blob.
 */
export async function getCheckedAt(source: File | Blob): Promise<number> {
  try {
    const data = await exifr.parse(source, ["DateTimeOriginal"]);
    const v = data?.DateTimeOriginal;
    if (v instanceof Date && !Number.isNaN(v.getTime())) {
      return v.getTime();
    }
    if (typeof v === "string") {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.getTime();
    }
  } catch {
    // EXIF parsing can throw on PNGs, screenshots without metadata, etc.
  }
  if (source instanceof File && source.lastModified) return source.lastModified;
  return Date.now();
}
