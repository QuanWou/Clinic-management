import type { AppSurface, UiState } from "./types/contracts";

export function resolveSurface(pathname: string): AppSurface {
  if (pathname.startsWith("/platform")) return "platform";
  if (pathname.startsWith("/workspace")) return "workspace";
  return "public";
}

export function resolveUiState(search: string): UiState {
  const value = new URLSearchParams(search).get("state");
  if (value === "loading" || value === "empty" || value === "denied" || value === "error" || value === "partial") {
    return value;
  }
  return "ready";
}
