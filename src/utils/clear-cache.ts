export function clearAllCachesAndReload(): void {
  // Clear known localStorage keys
  const keysToRemove = ["maptoposter_config", "lang", "PARAGLIDE_LOCALE"];
  for (const key of keysToRemove) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  // Clear prefixed district cache keys
  try {
    const allKeys = Object.keys(localStorage);
    for (const key of allKeys) {
      if (key.startsWith("maptoposter_districts_") || key === "maptoposter_nominatim_map") {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }

  // Delete IndexedDB database
  const deleteReq = indexedDB.deleteDatabase("MapPosterDB");
  deleteReq.onsuccess = () => {
    window.location.reload();
  };
  deleteReq.onerror = () => {
    window.location.reload();
  };
  deleteReq.onblocked = () => {
    window.location.reload();
  };
}
