/**
 * Car photo upload to Cloud Storage (V2 feature 13). The photo the driver attaches on the Service
 * screen is uploaded when the order is placed, and its download URL is saved on the order so the
 * technician can open it in Provider Mode.
 *
 *   order-photos/{uid}/{orderId}.jpg    (rules: firebase/storage.rules)
 *
 * Only the development build has the native Storage module. In Expo Go the photo stays on the
 * phone, which is enough for Provider Mode on one phone.
 */

/** The part of Cloud Storage SANAD needs (the real one wraps React Native Firebase). */
export interface PhotoStorageApi {
  /** Uploads a local file and returns its download URL. */
  upload(path: string, localUri: string, contentType: string): Promise<string>;
}

/** Where a car photo for an order is stored. */
export const orderPhotoPath = (uid: string, orderId: string) => `order-photos/${uid}/${orderId}.jpg`;

/** Uploads the car photo for an order. Returns the storage path and download URL. */
export async function uploadOrderPhoto(
  uid: string,
  orderId: string,
  localUri: string,
  api: PhotoStorageApi = getPhotoStorageApi(),
): Promise<{ path: string; url: string }> {
  const path = orderPhotoPath(uid, orderId);
  const url = await api.upload(path, localUri, 'image/jpeg');
  return { path, url };
}

/** Wraps the React Native Firebase Storage modular API. Only called inside the development build. */
export function createPhotoStorageApi(): PhotoStorageApi {
  // Required lazily so Expo Go and the tests never load the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const st = require('@react-native-firebase/storage');
  return {
    async upload(path, localUri, contentType) {
      const ref = st.ref(st.getStorage(), path);
      await st.putFile(ref, localUri.replace(/^file:\/\//, ''), { contentType });
      return st.getDownloadURL(ref);
    },
  };
}

let api: PhotoStorageApi | null = null;

export function getPhotoStorageApi(): PhotoStorageApi {
  if (!api) api = createPhotoStorageApi();
  return api;
}

/** Short message when the upload fails (the order itself is still placed). */
export const PHOTO_UPLOAD_FAILED = 'Your car photo could not be uploaded, so the technician will not see it. The order is still placed.';
