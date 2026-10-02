import { describe, expect, it } from "vitest";
import { resolveSurface, resolveUiState } from "../routing";

describe("routing", () => {
  it("keeps public, workspace and platform as separate surfaces", () => {
    expect(resolveSurface("/")).toBe("public");
    expect(resolveSurface("/public/search")).toBe("public");
    expect(resolveSurface("/workspace")).toBe("workspace");
    expect(resolveSurface("/platform/reviews")).toBe("platform");
  });

  it("supports the required S0-06 visual states", () => {
    for (const state of ["loading", "empty", "denied", "error", "partial"] as const) {
      expect(resolveUiState(`?state=${state}`)).toBe(state);
    }
    expect(resolveUiState("?state=unknown")).toBe("ready");
  });
});
