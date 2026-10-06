import type { ChartPoint, PlatformSubmissionSummary, PublicClinicCard, WorkspaceContext, WorkspaceMetric } from "../types/contracts";

export const syntheticContexts: WorkspaceContext[] = [
  {
    clinicId: "10000000-0000-4000-8000-000000000001",
    clinicName: "SYNTHETIC Clinic A",
    branchId: "11000000-0000-4000-8000-000000000001",
    branchName: "Toàn phòng khám",
    role: "ADMIN"
  }
];

export const publicClinics: PublicClinicCard[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    slug: "synthetic-clinic-a",
    name: "Phòng khám Đa khoa An Tâm",
    description: "Khám ngoại trú tổng quát với đội ngũ bác sĩ nhiều chuyên khoa.",
    verified: true,
    location: "Hà Nội",
    specialties: ["Nội tổng quát", "Nhi", "Da liễu"],
    branches: 2,
    priceFromVnd: 100000,
    imageUrl: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=1200&q=80"
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    slug: "synthetic-clinic-b",
    name: "Phòng khám Minh Tâm",
    description: "Cơ sở ngoại trú tập trung vào khám tổng quát và chăm sóc gia đình.",
    verified: true,
    location: "Hà Nội",
    specialties: ["Gia đình", "Nội khoa"],
    branches: 1,
    priceFromVnd: 120000,
    imageUrl: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80"
  }
];

export const workspaceMetrics: WorkspaceMetric[] = [
  { label: "Lịch hẹn hôm nay", value: "48", detail: "12 lịch trong 2 giờ tới", trend: "+8%" },
  { label: "Đã tiếp nhận", value: "31", detail: "64,6% tổng lịch hôm nay", trend: "+5%" },
  { label: "Đang chờ", value: "7", detail: "Thời gian chờ TB 16 phút", trend: "-3 phút" },
  { label: "Bác sĩ đang làm việc", value: "9", detail: "2 chuyên khoa đang cao tải" }
];

export const appointmentTrend: ChartPoint[] = [
  { label: "T2", value: 37 },
  { label: "T3", value: 42 },
  { label: "T4", value: 40 },
  { label: "T5", value: 52 },
  { label: "T6", value: 48 },
  { label: "T7", value: 31 },
  { label: "CN", value: 18 }
];

export const platformSubmissions: PlatformSubmissionSummary[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    name: "SYNTHETIC Clinic Sunrise",
    submittedAt: "30/09/2026 · 15:20",
    branches: 2,
    reviewStatus: "SUBMITTED",
    evidenceStatus: "Đủ hồ sơ"
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    name: "SYNTHETIC Clinic River",
    submittedAt: "30/09/2026 · 11:05",
    branches: 1,
    reviewStatus: "NEEDS_CHANGES",
    evidenceStatus: "Cần bổ sung"
  }
];
