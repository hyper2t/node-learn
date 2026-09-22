/**
 * Platform file picking. Returns a normalised descriptor; nothing is uploaded
 * yet. Domain screens never touch expo-image-picker / document-picker directly.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

export type PickedFile = { uri: string; name: string; mimeType: string; size: number; kind: 'image' | 'file' };

const guessMime = (name: string, fallback = 'application/octet-stream') => {
  const ext = name.split('.').pop()?.toLowerCase();
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf', zip: 'application/zip', txt: 'text/plain', md: 'text/markdown' } as Record<string, string>)[ext ?? ''] ?? fallback;
};

export async function pickImage(opts: { allowsEditing?: boolean; aspect?: [number, number] } = {}): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: opts.allowsEditing, aspect: opts.aspect, exif: false });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  const name = a.fileName ?? `image-${Date.now()}.jpg`;
  return { uri: a.uri, name, mimeType: a.mimeType ?? guessMime(name, 'image/jpeg'), size: a.fileSize ?? 0, kind: 'image' };
}

export async function pickDocuments(max = 5): Promise<PickedFile[]> {
  const res = await DocumentPicker.getDocumentAsync({ multiple: max > 1, copyToCacheDirectory: true, type: ['image/*', 'application/pdf', 'application/zip', 'text/plain', 'text/markdown'] });
  if (res.canceled) return [];
  return res.assets.slice(0, max).map((a) => ({
    uri: a.uri, name: a.name, mimeType: a.mimeType ?? guessMime(a.name), size: a.size ?? 0, kind: (a.mimeType ?? guessMime(a.name)).startsWith('image/') ? 'image' : 'file',
  }));
}
