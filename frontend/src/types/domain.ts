export type Role = {
  id?: string;
  code?: string;
  name?: string;
};

export type CurrentUser = {
  id?: string;
  userId?: string;
  email: string;
  fullName?: string;
  phone?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'LOCKED' | string;
  roles?: Role[] | string[];
};

export type AuthResponse = {
  userId?: string;
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

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
export type InvoiceStatus = 'UNPAID' | 'PAID' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'INSURANCE' | string;
export type NotificationType = 'EMAIL' | 'SMS' | 'PUSH' | string;
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
  userId: string;
  dob?: string | null;
  gender?: PatientGender | string | null;
  address?: string | null;
  bloodType?: string | null;
  updatedAt?: string | null;
};

export type UpdatePatientProfileRequest = {
  dob: string | null;
  gender: string | null;
  address: string | null;
  bloodType: string | null;
};

export type DoctorProfileResponse = {
  id: string;
  userId: string;
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

export type SpecialtyResponse = {
  id: string;
  name: string;
  description?: string | null;
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

export type PrescriptionItemResponse = {
  id: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  note?: string | null;
};

export type PrescriptionResponse = {
  id: string;
  items: PrescriptionItemResponse[];
  createdAt?: string | null;
};

export type MedicalRecordResponse = {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  symptoms?: string | null;
  diagnosis: string;
  notes?: string | null;
  prescriptions: PrescriptionResponse[];
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type InvoiceResponse = {
  id: string;
  patientId: string;
  appointmentId: string;
  totalAmount: number | string;
  status: InvoiceStatus;
  paymentMethod?: PaymentMethod | null;
  paidAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type NotificationResponse = {
  id: string;
  recipient: string;
  subject: string;
  content: string;
  type: NotificationType;
  status: NotificationStatus;
  sentAt?: string | null;
};

export type DashboardResponse = {
  user: CurrentUser | Record<string, unknown>;
  appointments: AppointmentResponse[];
  medicalRecords: MedicalRecordResponse[];
  invoices: InvoiceResponse[];
};
