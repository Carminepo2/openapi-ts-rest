import { useCallback, useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return (): void => {
    window.removeEventListener("storage", callback);
  };
}

export function useLocalStorage(
  key: string,
  initialValue: string
): [string, (newValue: string) => void] {
  const getSnapshot = useCallback(
    () => localStorage.getItem(key) ?? initialValue,
    [key, initialValue]
  );

  const getServerSnapshot = useCallback(() => initialValue, [initialValue]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = (newValue: string): void => {
    localStorage.setItem(key, newValue);
    window.dispatchEvent(new Event("storage"));
  };

  return [value, setValue];
}
