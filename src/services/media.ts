import * as ImagePicker from 'expo-image-picker';

/** Opens the camera, or the photo library when `source` is 'library'. Returns the image URI or null. */
export async function pickCarPhoto(source: 'camera' | 'library'): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, allowsEditing: true };
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera permission was denied');
    const result = await ImagePicker.launchCameraAsync(options);
    return result.canceled ? null : result.assets[0]?.uri ?? null;
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Photo library permission was denied');
  const result = await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : result.assets[0]?.uri ?? null;
}
