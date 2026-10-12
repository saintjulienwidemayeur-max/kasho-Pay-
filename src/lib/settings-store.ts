const KEY = "kasho_settings";

// Kasho Pay is a USD-only account — currency is fixed, not user-selectable.
export type KashoSettings = { biometricLogin: boolean };
const DEFAULT_SETTINGS: KashoSettings = { biometricLogin: false };

export function getSettings(): KashoSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<KashoSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function setSettings(settings: KashoSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(settings));
}
