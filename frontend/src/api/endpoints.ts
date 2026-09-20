export const apiEndpoints = {
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout'
  },
  users: {
    me: '/api/users/me'
  },
  patients: {
    profile: '/api/patients/profile'
  },
  doctors: {
    collection: '/api/doctors',
    profile: '/api/doctors/profile',
    profileSchedules: '/api/doctors/profile/schedules',
    byId: (doctorId: string) => `/api/doctors/${doctorId}`,
    schedules: (doctorId: string) => `/api/doctors/${doctorId}/schedules`,
    availability: (doctorId: string) => `/api/doctors/${doctorId}/availability`
  },
  specialties: {
    collection: '/api/specialties'
  },
  appointments: {
    collection: '/api/appointments',
    my: '/api/appointments/my',
    byId: (id: string) => `/api/appointments/${id}`,
    cancel: (id: string) => `/api/appointments/${id}/cancel`,
    confirm: (id: string) => `/api/appointments/${id}/confirm`,
    complete: (id: string) => `/api/appointments/${id}/complete`
  },
  medicalRecords: {
    collection: '/api/medical-records',
    my: '/api/medical-records/my',
    byId: (id: string) => `/api/medical-records/${id}`,
    byPatient: (patientId: string) => `/api/medical-records/patients/${patientId}`
  },
  invoices: {
    collection: '/api/invoices',
    my: '/api/invoices/my',
    byId: (id: string) => `/api/invoices/${id}`,
    byPatient: (patientId: string) => `/api/invoices/patients/${patientId}`,
    byAppointment: (appointmentId: string) => `/api/invoices/appointments/${appointmentId}`,
    pay: (id: string) => `/api/invoices/${id}/pay`
  },
  notifications: {
    collection: '/api/notifications',
    byId: (id: string) => `/api/notifications/${id}`
  },
  dashboard: {
    me: '/api/dashboard/me'
  }
} as const;
