import * as SecureStore from 'expo-secure-store';

/**
 * Supabase auth storage backed by expo-secure-store (spec: tokens in SecureStore).
 * SecureStore rejects values over 2048 bytes and a Supabase session is larger,
 * so values are split into chunks: `<key>` holds the chunk count, `<key>.<i>` the parts.
 */
const CHUNK_SIZE = 1800;

const removeChunks = async (key: string) => {
  const count = Number(await SecureStore.getItemAsync(key));
  for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
  await SecureStore.deleteItemAsync(key);
};

export const secureSessionStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const count = Number(await SecureStore.getItemAsync(key));
    if (!count) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) return null; // incomplete write: treat as signed out
      parts.push(part);
    }
    return parts.join('');
  },

  setItem: async (key: string, value: string): Promise<void> => {
    await removeChunks(key);
    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    // Count last, so a partially written session is never read back
    await SecureStore.setItemAsync(key, String(count));
  },

  removeItem: removeChunks,
};
