import { Building2, MapPin, ShieldCheck } from "lucide-react";
import type { WorkspaceContext } from "../types/contracts";

interface Props {
  contexts: WorkspaceContext[];
  value: WorkspaceContext;
  switching?: boolean;
  onChange: (next: WorkspaceContext) => void;
}

export function ContextSwitcher({ contexts, value, switching, onChange }: Props) {
  const branchKey = `${value.clinicId}|${value.branchId}`;

  return (
    <div className="context-switcher" aria-label="Phạm vi làm việc hiện tại">
      <div className="context-field">
        <Building2 size={16} aria-hidden="true" />
        <div>
          <span className="context-label">Phòng khám</span>
          <strong>{value.clinicName}</strong>
        </div>
      </div>

      <label className="context-select">
        <MapPin size={16} aria-hidden="true" />
        <span className="sr-only">Chọn chi nhánh</span>
        <select
          value={branchKey}
          disabled={switching}
          onChange={(event) => {
            const [clinicId, branchId] = event.target.value.split("|");
            const next = contexts.find((item) => item.clinicId === clinicId && item.branchId === branchId);
            if (next) onChange(next);
          }}
        >
          {contexts.map((item) => (
            <option key={`${item.clinicId}|${item.branchId}`} value={`${item.clinicId}|${item.branchId}`}>
              {item.branchName}
            </option>
          ))}
        </select>
      </label>

      <div className="context-role">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>{roleLabel(value.role)}</span>
      </div>
    </div>
  );
}

function roleLabel(role: WorkspaceContext["role"]) {
  return {
    CLINIC_OWNER: "Chủ cơ sở",
    CLINIC_MANAGER: "Quản lý",
    RECEPTIONIST: "Lễ tân",
    DOCTOR: "Bác sĩ",
    CASHIER: "Thu ngân",
    LAB: "Cận lâm sàng"
  }[role];
}
