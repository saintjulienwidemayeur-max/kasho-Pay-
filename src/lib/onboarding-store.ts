const KEY = "kasho_onboarded";

export function isOnboarded(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(KEY) === "1";
}

export function setOnboarded() {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, "1");
}
