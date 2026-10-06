import { Component, Suspense, type ReactNode } from 'react';

class PanelLoadBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() {
    if (this.state.failed) return <section className="panel-load-state" role="alert">
      <h2>Chưa mở được màn hình</h2>
      <p>Không thể tự mở màn hình này. Nếu đang có thao tác chờ xác nhận, hãy kiểm tra kết quả đã ghi trước khi gửi lại.</p>
    </section>;
    return this.props.children;
  }
}

export function AsyncPanel({children, label = 'Đang mở màn hình…'}: {children: ReactNode; label?: string}) {
  return <PanelLoadBoundary><Suspense fallback={<div className="panel-load-state" role="status" aria-live="polite">
    <span className="panel-load-indicator" aria-hidden="true"/>{label}
  </div>}>{children}</Suspense></PanelLoadBoundary>;
}
