export type AppSurface = "public" | "workspace" | "platform";
export type UiState = "ready" | "loading" | "empty" | "denied" | "error" | "partial";

export interface WorkspaceContext {
  clinicId: string;
  clinicName: string;
  branchId: string;
  branchName: string;
  role: "CLINIC_OWNER" | "CLINIC_MANAGER" | "RECEPTIONIST" | "DOCTOR" | "CASHIER" | "LAB";
}

export interface CurrentActor {
  userId: string;
  legacyRoles: string[];
  platformOperator: boolean;
}

export interface IamContextView {
  membershipId: string;
  clinicId: string;
  role: WorkspaceContext["role"];
  allBranches: boolean;
  branchIds: string[];
  version: number;
}

export interface ClinicBranchView {
  id: string;
  name: string;
  address: string;
  openingHours: string;
  active: boolean;
}

export interface ClinicPublicView {
  id: string;
  slug: string;
  name: string;
  publicDescription?: string;
  publishedAt?: string;
  branches: ClinicBranchView[];
}

export interface ClinicOwnerView {
  id: string;
  ownerUserId: string;
  slug: string;
  name: string;
  publicDescription?: string;
  reviewStatus: "DRAFT" | "SUBMITTED" | "NEEDS_CHANGES" | "APPROVED" | "REJECTED";
  publicationStatus: "UNPUBLISHED" | "PUBLISHED" | "SUSPENDED";
  evidenceVerified: boolean;
  branches: ClinicBranchView[];
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface PublicClinicCard {
  id: string;
  slug: string;
  name: string;
  description: string;
  verified: boolean;
  location: string;
  specialties: string[];
  branches: number;
  priceFromVnd?: number;
  imageUrl: string;
}

export interface PlatformSubmissionSummary {
  id: string;
  name: string;
  submittedAt: string;
  branches: number;
  reviewStatus: "SUBMITTED" | "NEEDS_CHANGES" | "APPROVED";
  evidenceStatus: "Đủ hồ sơ" | "Cần bổ sung";
}

export interface ApiProblemShape {
  error?: {
    code?: string;
    message?: string;
  };
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  message?: string;
  code?: string;
}

export interface WorkspaceMetric {
  label: string;
  value: string;
  detail: string;
  trend?: string;
}

export interface ChartPoint {
  label: string;
  value: number;
}
