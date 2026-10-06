import { describe, expect, it } from "vitest";
import { recoveryMessage } from "../api/client";

describe("API recovery copy", () => {
  it("does not expose a raw 403 as the only guidance", () => {
    const message = recoveryMessage(403);
    expect(message).not.toBe("403");
    expect(message).toContain("quyền");
    expect(message).toContain("phòng khám");
  });

  it("distinguishes auth expiry, conflict and service failure", () => {
    expect(recoveryMessage(401)).toContain("đăng nhập");
    expect(recoveryMessage(409)).toContain("tải lại");
    expect(recoveryMessage(503)).toContain("thử lại");
  });
});
