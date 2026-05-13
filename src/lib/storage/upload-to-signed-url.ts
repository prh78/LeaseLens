type UploadPdfToSignedUrlOptions = Readonly<{
  signedUrl: string;
  file: File;
  /** Logged-in user's access token so Storage runs as `authenticated` (query token alone is not enough for RLS). */
  accessToken: string;
  /** Same value the Supabase JS client sends as `apikey` (anon / publishable key). */
  apiKey: string;
  onProgress?: (loaded: number, total: number) => void;
}>;

/**
 * PUT upload to a Supabase signed upload URL using multipart/form-data,
 * matching @supabase/storage-js uploadToSignedUrl (Blob branch) so Storage accepts the body.
 *
 * Sends `Authorization` and `apikey` like the Supabase client's `fetchWithAuth`, otherwise
 * the request is effectively anonymous and `storage.objects` policies for `authenticated` fail.
 */
export function uploadPdfToSignedUrl({
  signedUrl,
  file,
  accessToken,
  apiKey,
  onProgress,
}: UploadPdfToSignedUrlOptions): Promise<void> {
  const formData = new FormData();
  formData.append("cacheControl", "3600");
  formData.append("", file, file.name);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", apiKey);

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
