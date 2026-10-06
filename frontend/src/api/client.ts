import type {
  ApiProblemShape,
  ApiResult,
  ClinicOwnerView,
  ClinicPublicView,
  CurrentActor,
  IamContextView,
  PageResponse
} from "../types/contracts";

const identityBase = import.meta.env.VITE_IDENTITY_URL ?? "http://127.0.0.1:8093";
const clinicBase = import.meta.env.VITE_CLINIC_URL ?? "http://127.0.0.1:8092";

export async function requestJson<T>(url: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {})
      }
    });
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json") ? await response.json() : undefined;
    if (!response.ok) {
      if(response.status===401&&new Headers(init.headers).has('Authorization')&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent('clinic:session-invalid',{detail:{authorization:new Headers(init.headers).get('Authorization')}}));
      const problem = body as ApiProblemShape | undefined;
      return {
        ok: false,
        status: response.status,
        code: problem?.error?.code,
        message: problem?.error?.message&&/[À-ỹ]/u.test(problem.error.message)?problem.error.message:response.status===401&&!new Headers(init.headers).has('Authorization')?'Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.':recoveryMessage(response.status)
      };
    }
    return { ok: true, status: response.status, data: body as T };
  } catch {
    return {
      ok: false,
      status: 0,
      code: "NETWORK_UNAVAILABLE",
      message: "Không thể kết nối đến dịch vụ. Kiểm tra kết nối rồi thử lại."
    };
  }
}

function bearer(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export function recoveryMessage(status: number): string {
  if (status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 403) return "Bạn chưa được cấp quyền cho công việc hoặc dữ liệu này. Kiểm tra quyền tại phòng khám.";
  if (status === 404) return "Không tìm thấy dữ liệu trong phạm vi hiện tại.";
  if (status === 409) return "Dữ liệu vừa thay đổi. Hãy tải lại trước khi tiếp tục.";
  if (status >= 500) return "Chưa xác định được kết quả. Đối chiếu dữ liệu đã ghi hoặc thử lại cùng yêu cầu trước khi tạo thao tác mới.";
  return "Không thể hoàn tất yêu cầu. Hãy kiểm tra dữ liệu và thử lại.";
}

export function getCurrentActor(token: string) {
  return requestJson<CurrentActor>(`${identityBase}/api/me/current`, { headers: bearer(token) });
}

export function getWorkspaceContexts(token: string) {
  return requestJson<IamContextView[]>(`${identityBase}/api/me/contexts`, { headers: bearer(token) });
}

export function getPublicClinics(page = 0, size = 20) {
  return requestJson<PageResponse<ClinicPublicView>>(
    `${clinicBase}/api/public/clinics?page=${page}&size=${size}`
  );
}

export function getPlatformSubmissions(token: string, status = "SUBMITTED") {
  return requestJson<PageResponse<ClinicOwnerView>>(
    `${clinicBase}/api/platform/clinics?status=${encodeURIComponent(status)}&page=0&size=20`,
    { headers: bearer(token) }
  );
}
