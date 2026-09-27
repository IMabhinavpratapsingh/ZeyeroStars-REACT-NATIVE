import * as ImageManipulator from 'expo-image-manipulator';

// Photo upload se pehle client-side hi image ko chhota/compress kar dete
// hain - taaki upload fast ho aur storage pe bhi kam jagah lage. Bina
// isके, phone se li gayi photo aksar 3-8MB tak ho sakti hai jabki profile
// photo kabhi itni badi dikhni bhi nahi (avatar circle chhota hi hota
// hai) - resize+recompress se usually 100-300KB tak aa jaati hai, bina
// visible quality loss ke.
//
// RN CHANGE: web version `canvas` + `Image` + `Blob`/`File` (browser-only
// APIs) use karta tha. RN mein wo exist nahi karte - iske equivalent
// `expo-image-manipulator` hai, jo resize + compress dono ek call mein
// kar deta hai (native code se, canvas se bhi fast hota hai).
//
// Install: npx expo install expo-image-manipulator
//
// maxDimension: photo ki lambi side (width ya height, jo bhi bada ho) is
// se zyada nahi hogi - dusri side proportionally chhoti hoti hai (aspect
// ratio maintain, manipulator khud karta hai).
// quality: JPEG compression quality (0-1).
//
// uri: local file uri (jaise expo-image-picker se milta hai - file://...)
// Return: Promise<{ uri, width, height }> - naya compressed JPEG file ka
// local uri, jise seedha FormData mein daal ke upload kar sakte ho.
export async function compressImage(
  uri: string,
  { maxDimension = 1024, quality = 0.8 }: { maxDimension?: number; quality?: number } = {}
): Promise<ImageManipulator.ImageResult> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxDimension } }], // height auto-scale hota hai (aspect ratio maintain)
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result;
}

// Upload ke waqt FormData mein daalne ka helper - RN mein File/Blob nahi
// hota, seedha { uri, name, type } object FormData.append() ko dena hota hai.
export function toUploadFormPart(result: ImageManipulator.ImageResult, fileName = 'photo.jpg') {
  return {
    uri: result.uri,
    name: fileName,
    type: 'image/jpeg',
  } as any;
}