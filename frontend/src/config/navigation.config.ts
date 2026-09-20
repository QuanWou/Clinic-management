import {
  CalendarDays,
  FileText,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Stethoscope,
  UserRound,
  UsersRound
} from 'lucide-react';
import type { NavigationItem } from '../types/view';

export const mainNavigation: NavigationItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays },
  { id: 'patients', label: 'Patients', icon: UsersRound },
  { id: 'doctors', label: 'Doctors', icon: Stethoscope },
  { id: 'doctor-profile', label: 'Doctor Profile', icon: UserRound, roles: ['ROLE_DOCTOR'] },
  { id: 'medical-records', label: 'Medical Records', icon: FileText },
  { id: 'invoices', label: 'Invoices', icon: ReceiptText },
  { id: 'settings', label: 'Settings', icon: Settings }
];
