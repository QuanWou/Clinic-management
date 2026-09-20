import {
  CalendarDays,
  FileText,
  LayoutDashboard,
  ReceiptText,
  Bell,
  ClipboardList,
  Settings,
  Stethoscope,
  UserRound,
  UsersRound
} from 'lucide-react';
import type { NavigationItem } from '../types/view';

export const mainNavigation: NavigationItem[] = [
  { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'appointments', label: 'Lịch hẹn', icon: CalendarDays },
  { id: 'patients', label: 'Bệnh nhân', icon: UsersRound },
  { id: 'doctors', label: 'Bác sĩ', icon: Stethoscope },
  { id: 'doctor-profile', label: 'Hồ sơ bác sĩ', icon: UserRound, roles: ['ROLE_DOCTOR'] },
  { id: 'medical-records', label: 'Hồ sơ bệnh án', icon: FileText },
  { id: 'invoices', label: 'Hóa đơn', icon: ReceiptText },
  { id: 'catalog', label: 'Danh mục', icon: ClipboardList },
  { id: 'notifications', label: 'Thông báo', icon: Bell },
  { id: 'settings', label: 'Cài đặt', icon: Settings }
];
