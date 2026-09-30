export type Role = {
  id?: string;
  code?: string;
  name?: string;
};

export type CurrentUser = {
  id?: string;
  userId?: string;
  accountCode?: string;
  email: string;
  fullName?: string;
  phone?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'LOCKED' | string;
  roles?: Role[] | string[];
};

export type AuthResponse = {
  userId?: string;
  accountCode?: string;
  email?: string;
  fullName?: string;
  roles?: string[];
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  expiresIn?: number;
  user?: CurrentUser;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
};

export type CreateAppointmentRequest = {
  doctorId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  reason: string;
};

export type ReceptionBookingRequest = CreateAppointmentRequest & { patientId: string };
export type ReceptionRescheduleRequest = Omit<CreateAppointmentRequest, 'reason'>;
export type ReceptionAppointmentResponse = AppointmentResponse & { patientName: string };
export type ReceptionPatientResponse = {
  id: string;
  patientCode?: string;
  userId: string | null;
  fullName: string;
  phone: string;
  dob: string | null;
  gender: string | null;
  address: string | null;
  bloodType: string | null;
};
export type RegisterWalkInPatientRequest = {
  fullName: string;
  phone: string;
  dob?: string | null;
  gender?: string | null;
  address?: string | null;
  bloodType?: string | null;
};
export type QueueStatus = 'WAITING' | 'CALLED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
export type ReceptionVisitResponse = {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName?: string | null;
  doctorId: string;
  visitDate: string;
  queueNumber: number;
  status: QueueStatus;
  checkedInAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type EncounterContextResponse = {
  visitId: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  queueNumber: number;
  queueStatus: QueueStatus;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  reason: string | null;
  patient: {
    id: string;
    fullName: string;
    dob: string | null;
    gender: string | null;
    bloodType: string | null;
  };
};

/** Aggregated by the appointment service, scoped to the authenticated staff role. */
export type ReceptionHistoryResponse = {
  from: string;
  to: string;
  scope: 'RECEPTION' | 'DOCTOR';
  days: Array<{ date: string; appointments: number; checkIns: number;
    completedVisits: number; cancelledAppointments: number }>;
};
export type PerformedServicesResponse = {
  appointmentId: string;
  finalized: boolean;
  revision: string | null;
  items: Array<{ performedItemId: string; serviceId: string; quantity: number; serviceDate: string }>;
};
export type LabOrderStatus = 'ORDERED' | 'COLLECTED' | 'PROCESSING' | 'RESULTED' | 'RELEASED';
export type LabOrderResponse = {
  id: string; medicalRecordId: string; testCode: string; testName: string;
  serviceId: string; performedOn: string; status: LabOrderStatus;
  sampleIdentifier: string | null; collectedAt: string | null;
  resultValue: string | null; resultUnit: string | null; referenceRange: string | null;
  resultedAt: string | null; releasedAt: string | null;
};
export type LabBillableItemsResponse = {
  appointmentId: string;
  items: Array<{ orderId: string; testCode: string; quantity: number; status: LabOrderStatus;
    billableAt: string | null; serviceId: string; performedOn: string }>;
  finalizedForBilling: boolean;
  billableRevision: string | null;
};
/** Doctor-only read-only status: never exposes financial items or clinical results. */
export type LabBillingStatusResponse = { medicalRecordId: string; finalizedForBilling: boolean };
export type AppointmentAvailabilityResponse = {
  doctorId: string; date: string; startTime: string; endTime: string; available: boolean;
};
export type PageResponse<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};
export type AdminDoctorResponse = DoctorProfileResponse & { active: boolean };
/** Identity's administrator-only account lookup; never returned by public doctor directories. */
export type AdminUserResponse = {
  id: string;
  fullName: string;
  accountCode?: string;
};
/** Administrator-only doctor profile operations; account creation belongs to Identity. */
export type CreateAdminDoctorRequest = {
  userId: string; specialtyId: string; biography: string; consultationFee: string;
};
export type UpdateAdminDoctorRequest = Omit<CreateAdminDoctorRequest, 'userId'> & { active: boolean };
export type AdminDoctorSchedule = {
  id: string; doctorId: string | null; dayOfWeek: number; startTime: string; endTime: string;
};
export type SpecialtyResponse = { id: string; name: string; description: string | null };
export type CatalogServiceResponse = { id: string; code: string; name: string; description: string | null; active: boolean };
export type MedicineResponse = { id: string; code: string; name: string; unit: string; description: string | null; active: boolean };
export type PriceResponse = {
  id: string; serviceId: string; amount: number | string; currency: string;
  effectiveFrom: string; effectiveUntil: string | null;
};

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
export type InvoiceStatus = 'UNPAID' | 'PAID' | 'REFUNDED' | 'RECONCILIATION_REQUIRED' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'INSURANCE' | string;
export type NotificationType = 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | string;
export type PatientGender = 'MALE' | 'FEMALE' | 'OTHER';

export type UpdatePatientProfileRequest = {
  dob: string;
  gender: PatientGender;
  address?: string;
  bloodType?: string;
};

export type PatientProfileResponse = {
  id: string;
  patientCode?: string;
  userId: string;
  dob?: string | null;
  gender?: PatientGender | string | null;
  address?: string | null;
  bloodType?: string | null;
  updatedAt?: string | null;
};

export type DoctorProfileResponse = {
  id: string;
  doctorCode?: string;
  userId: string;
  /** Verified from the linked, active DOCTOR account in Identity. */
  fullName?: string;
  specialtyId?: string | null;
  specialtyName?: string | null;
  biography?: string | null;
  consultationFee?: number | string | null;
};

export type UpdateDoctorProfileRequest = {
  specialtyId: string;
  biography?: string;
  consultationFee: number;
};

export type DoctorSchedule = {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type UpdateDoctorSchedulesRequest = {
  schedules: Array<Omit<DoctorSchedule, 'id'>>;
};

export type AppointmentResponse = {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  reason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type PrescriptionStatus = 'DRAFT' | 'SIGNED';

export type PrescriptionItemResponse = {
  id: string;
  medicineId?: string | null;
  medicineCode?: string | null;
  medicineName: string;
  medicineUnit?: string | null;
  dosage: string;
  frequency: string;
  duration: string;
  route?: string | null;
  quantity?: number | null;
  note?: string | null;
};

export type PrescriptionResponse = {
  id: string;
  items: PrescriptionItemResponse[];
  createdAt?: string | null;
  status?: PrescriptionStatus;
  version?: number | null;
  signedAt?: string | null;
  signedBy?: string | null;
};

export type PrescriptionItemDraftRequest = {
  medicineId: string;
  dosage: string;
  frequency: string;
  duration: string;
  route?: string | null;
  quantity?: number | null;
  note?: string | null;
};

export type MedicalRecordStatus = 'DRAFT' | 'FINAL';

export type MedicalRecordResponse = {
  id: string;
  recordCode?: string | null;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  patientCode?: string | null;
  patientName?: string | null;
  doctorCode?: string | null;
  doctorName?: string | null;
  appointmentDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  symptoms?: string | null;
  diagnosis?: string | null;
  notes?: string | null;
  prescriptions: PrescriptionResponse[];
  createdAt?: string | null;
  updatedAt?: string | null;
  status?: MedicalRecordStatus;
  version?: number | null;
  finalizedAt?: string | null;
  finalizedBy?: string | null;
};

export type InvoiceResponse = {
  id: string;
  patientId: string;
  appointmentId: string;
  totalAmount: number | string;
  catalogRevision?: string | null;
  // Required in the newest Task 05 DTO, optional during migration from baseline.
  currency?: string | null;
  items?: InvoiceItemResponse[] | null;
  status: InvoiceStatus;
  paymentMethod?: PaymentMethod | null;
  paidAt?: string | null;
  paidBy?: string | null;
  refundedAt?: string | null;
  refundedBy?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type InvoiceItemResponse = {
  id: string;
  sourceType: string;
  sourceId: string;
  serviceId: string;
  serviceCode: string;
  serviceName: string;
  priceId: string;
  serviceDate: string;
  unitPrice: number | string;
  quantity: number;
  lineAmount: number | string;
  currency: string;
};

export type PaymentTransactionResponse = {
  id: string;
  invoiceId: string;
  type: 'CAPTURE' | 'REFUND';
  provider: string;
  externalReference: string;
  amount: number | string;
  currency: string;
  status: string;
  confirmedBy: string;
  confirmedAt: string;
  reason: string | null;
};

export type NotificationResponse = {
  id: string;
  subject: string;
  content: string;
  type: NotificationType;
  status: NotificationStatus;
  sentAt?: string | null;
  readAt?: string | null;
  createdAt?: string | null;
};
export type NotificationPreferenceResponse = { type: NotificationType; enabled: boolean };

export type DashboardResponse = {
  user: CurrentUser | Record<string, unknown>;
  appointments: AppointmentResponse[];
  medicalRecords: MedicalRecordResponse[];
  invoices: InvoiceResponse[];
};
