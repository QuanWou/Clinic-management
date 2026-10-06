import { AlertTriangle, Ban, Inbox, RefreshCw, WifiOff } from "lucide-react";
import type { UiState } from "../types/contracts";

interface Props {
  state: UiState;
  title?: string;
  onRetry?: () => void;
}

export function UiStatePanel({ state, title, onRetry }: Props) {
  if (state === "ready") return null;

  if (state === "loading") {
    return (
      <section className="state-card" aria-busy="true" aria-live="polite">
        <div className="state-icon skeleton-dot" />
        <div>
          <p className="state-title">{title ?? "Đang tải dữ liệu"}</p>
          <p className="state-copy">Đang lấy dữ liệu mới theo cơ sở và chi nhánh hiện tại.</p>
          <div className="skeleton-lines" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>
    );
  }

  const config = {
    empty: {
      icon: <Inbox size={22} />,
      title: title ?? "Chưa có dữ liệu",
      copy: "Không có dữ liệu phù hợp với bộ lọc hiện tại. Thử đổi khoảng thời gian hoặc bộ lọc."
    },
    denied: {
      icon: <Ban size={22} />,
      title: title ?? "Bạn không có quyền xem nội dung này",
      copy: "Hãy kiểm tra đúng cơ sở, chi nhánh hoặc liên hệ quản trị viên để được cấp quyền."
    },
    error: {
      icon: <WifiOff size={22} />,
      title: title ?? "Không thể tải dữ liệu",
      copy: "Kết nối dịch vụ đang có vấn đề. Dữ liệu hiện tại chưa bị thay đổi."
    },
    partial: {
      icon: <AlertTriangle size={22} />,
      title: title ?? "Một phần dữ liệu chưa sẵn sàng",
      copy: "Một nguồn dữ liệu đang chậm hoặc tạm ngưng. Các phần còn lại vẫn có thể sử dụng."
    }
  }[state];

  return (
    <section className={`state-card state-${state}`} role={state === "error" || state === "denied" ? "alert" : "status"}>
      <div className="state-icon">{config.icon}</div>
      <div className="state-body">
        <p className="state-title">{config.title}</p>
        <p className="state-copy">{config.copy}</p>
        {(state === "error" || state === "partial") && (
          <button type="button" className="button-secondary" onClick={onRetry}>
            <RefreshCw size={16} /> Thử lại
          </button>
        )}
      </div>
    </section>
  );
}
