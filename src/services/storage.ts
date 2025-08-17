
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { auth } from '@/lib/firebase/config';
import { storage } from '@/lib/firebase/config';

/**
 * Uploads a file to Firebase Storage and returns the download URL.
 *
 * @param file The file to upload.
 * @param path The path in Firebase Storage to upload the file to.
 * @param onProgress A callback function to track the upload progress.
 * @returns A promise that resolves with the download URL of the uploaded file.
 */
export async function uploadFile(
  file: File,
  path: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  if (!auth) {
    throw new Error("Authentication service is not initialized.");
  }
  if (!auth.currentUser) {
    throw new Error('User not authenticated for file upload.');
  }
  if (!storage) {
    throw new Error('Firebase Storage is not configured.');
  }

  // Create a storage reference
  const storageRef = ref(storage, path);

  // Start the upload task
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        // Observe state change events such as progress, pause, and resume
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) {
          onProgress(progress);
        }
      },
      (error) => {
        // Handle unsuccessful uploads
        console.error('Upload failed:', error);
        reject(new Error(`Upload failed: ${error.code}`));
      },
      async () => {
        // Handle successful uploads on complete
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        } catch (error) {
          console.error('Failed to get download URL:', error);
          reject(new Error('Failed to get download URL.'));
        }
      }
    );
  });
}
