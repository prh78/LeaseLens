/**
 * PUT upload to a Supabase signed upload URL using multipart/form-data,
 * matching @supabase/storage-js uploadToSignedUrl (Blob branch) so Storage accepts the body.
 */
export function uploadPdfToSignedUrl(
  signedUrl: string,
  file: File,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  const formData = new FormData();
  formData.append("cacheControl", "3600");
  formData.append("", file, file.name);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);

    xhr.upload.onprogress = (event) => {
      if (!onProgress) {
        return;
      }
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      } else {
        onProgress(event.loaded, file.size);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      let message = `Upload failed (${xhr.status})`;
      try {
        const parsed = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        message = parsed.message ?? parsed.error ?? message;
      } catch {
        if (xhr.responseText) {
          message = xhr.responseText.slice(0, 200);
        }
      }
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));

    xhr.send(formData);
  });
}
