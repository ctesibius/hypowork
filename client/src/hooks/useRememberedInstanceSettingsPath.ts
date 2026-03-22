import { useEffect, useState } from "react";

import { useLocation } from "@/lib/router";
import {
  DEFAULT_INSTANCE_SETTINGS_PATH,
  normalizeRememberedInstanceSettingsPath,
} from "../lib/instance-settings";

const INSTANCE_SETTINGS_MEMORY_KEY = "paperclip.lastInstanceSettingsPath";

function readRememberedInstanceSettingsPath(): string {
  if (typeof window === "undefined") return DEFAULT_INSTANCE_SETTINGS_PATH;
  try {
    return normalizeRememberedInstanceSettingsPath(
      window.localStorage.getItem(INSTANCE_SETTINGS_MEMORY_KEY),
    );
  } catch {
    return DEFAULT_INSTANCE_SETTINGS_PATH;
  }
}

/** Keeps the instance settings deep-link in sync with localStorage and the current /instance/settings/* route. */
export function useRememberedInstanceSettingsPath(): string {
  const location = useLocation();
  const [path, setPath] = useState(readRememberedInstanceSettingsPath);

  useEffect(() => {
    if (!location.pathname.startsWith("/instance/settings/")) return;

    const nextPath = normalizeRememberedInstanceSettingsPath(
      `${location.pathname}${location.search}${location.hash}`,
    );
    setPath(nextPath);

    try {
      window.localStorage.setItem(INSTANCE_SETTINGS_MEMORY_KEY, nextPath);
    } catch {
      // Ignore storage failures in restricted environments.
    }
  }, [location.hash, location.pathname, location.search]);

  return path;
}
