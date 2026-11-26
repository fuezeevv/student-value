import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { createScopedStore } from "@studentvalue/mobile-contracts";
export const focusScope = (origin: string, userId?: string) =>
  JSON.stringify([new URL(origin).origin, userId ?? null]);
export const focusStore = createScopedStore(
  {
    get: SecureStore.getItemAsync,
    set: (key, value) =>
      SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      }),
    remove: SecureStore.deleteItemAsync,
  },
  async (scope) =>
    `sv_focus_v2_${await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, scope)}`,
);
