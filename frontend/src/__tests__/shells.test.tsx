import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicShell } from "../shells/PublicShell";
import { WorkspaceShell } from "../shells/WorkspaceShell";
import {canOpen} from '../auth/access';
import { UiStatePanel } from "../components/UiStatePanel";

describe("S0-06 application shells", () => {
  it("public shell starts with the single clinic introduction and links to booking", () => {
    const html = renderToStaticMarkup(<PublicShell state="ready" />);
    expect(html).not.toContain("Tìm cơ sở");
    expect(html).not.toContain("market-search");
    expect(html).toContain("Đặt lịch khám");
    expect(html).toContain("CHĂM SÓC SỨC KHỎE NGOẠI TRÚ");
    expect(html).toContain("Tài khoản bệnh nhân");
    expect(html).not.toContain("synthetic/demo");
  });

  it("workspace requires the common application session before showing staff data", () => {
    const html = renderToStaticMarkup(<WorkspaceShell state="ready" />);
    expect(html).toContain("Clinic Workspace");
    expect(html).toContain("Đăng nhập để mở công việc được phân công");
    expect(html).not.toContain("Chọn chi nhánh");
    expect(html).not.toContain("Chi nhánh phía Tây");
    expect(html).not.toContain("Đăng nhập tổng quan");
    expect(html).not.toContain("SYNTHETIC Clinic A");
    expect(html).not.toContain("Dữ liệu minh họa");
  });

  it("merged staff work retains the clinical and administrator boundaries", () => {
    const context=(role:'ADMIN'|'STAFF'|'DOCTOR')=>[{membershipId:'m',clinicId:'c',role,allBranches:true,branchIds:[],version:1}];
    expect(canOpen('reception',context('STAFF'))).toBe(true);
    expect(canOpen('billing',context('STAFF'))).toBe(true);
    expect(canOpen('doctor',context('STAFF'))).toBe(false);
    expect(canOpen('members',context('STAFF'))).toBe(false);
    expect(canOpen('doctor',context('DOCTOR'))).toBe(true);
    expect(canOpen('lab',context('DOCTOR'))).toBe(true);
    expect(canOpen('billing',context('DOCTOR'))).toBe(false);
    expect(canOpen('system',context('ADMIN'))).toBe(true);
    expect(canOpen('doctor',context('ADMIN'))).toBe(false);
  });

  it("denied and error states provide recovery guidance", () => {
    const denied = renderToStaticMarkup(<UiStatePanel state="denied" />);
    const error = renderToStaticMarkup(<UiStatePanel state="error" />);
    expect(denied).toContain("không có quyền");
    expect(denied).toContain("chi nhánh");
    expect(error).toContain("Thử lại");
    expect(error).not.toContain("Request failed (403)");
  });
});
