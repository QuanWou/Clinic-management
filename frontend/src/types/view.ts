import type { LucideIcon } from 'lucide-react';
import type {
  AppointmentResponse,
  AppointmentStatus,
  InvoiceResponse,
  InvoiceStatus,
  MedicalRecordResponse,
  MedicalRecordStatus
} from './domain';

export type AppView =
  | 'dashboard'
  | 'appointments'
  | 'patients'
  | 'doctors'
  | 'doctor-profile'
  | 'encounter'
  | 'medical-records'
  | 'invoices'
  | 'catalog'
  | 'notifications'
  | 'settings';

export type NavigationItem = {
  id: AppView;
  label: string;
  icon: LucideIcon;
  roles?: string[];
};

export type DemoPatient = {
  id: string;
  userId: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  email: string;
  address: string;
  bloodType: string;
  status: 'Active' | 'Inactive';
  lastVisit: string;
  avatar: string;
  emergencyContact: string;
  insuranceProvider: string;
};

export type DemoDoctor = {
  id: string;
  userId: string;
  name: string;
  specialtyName: string;
  department: string;
  experience: number;
  phone: string;
  email: string;
  status: 'Available' | 'Unavailable' | 'On Leave';
  avatar: string;
  biography: string;
  consultationFee: number;
  education: string;
  rating: number;
  totalPatients: number;
  languages: string[];
  workingHours: string;
};

export type UiAppointment = AppointmentResponse & {
  patientName: string;
  doctorName: string;
  department: string;
  patientAvatar: string;
  doctorAvatar: string;
};

export type UiMedicalRecord = Omit<MedicalRecordResponse, 'status'> & {
  patientName: string;
  doctorName: string;
  recordType: string;
  status: MedicalRecordStatus;
};

export type UiInvoice = InvoiceResponse & {
  patientName: string;
  patientAvatar: string;
};

export type DashboardMetric = {
  label: string;
  value: string;
  trend: string;
  trendDirection: 'up' | 'down';
  tone: 'green' | 'purple' | 'blue' | 'orange' | 'mint';
  series: number[];
};

export type StatusTone = AppointmentStatus | InvoiceStatus | DemoDoctor['status'] | DemoPatient['status'] | string;
