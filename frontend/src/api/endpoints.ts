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
    profile: '/api/patients/profile',
    reception: '/api/patients/reception',
    receptionById: (id: string) => `/api/patients/reception/${encodeURIComponent(id)}`
  },
  doctors: {
    collection: '/api/doctors',
    profile: '/api/doctors/profile',
    schedules: (doctorId: string) => `/api/doctors/${encodeURIComponent(doctorId)}/schedules`,
    availability: (doctorId: string) => `/api/doctors/${encodeURIComponent(doctorId)}/availability`,
    admin: '/api/doctors/admin'
  },
  specialties: {
    collection: '/api/specialties'
  },
  catalog: {
    services: '/api/catalog/services',
    medicines: '/api/catalog/medicines',
    servicePrice: (id: string) => `/api/catalog/services/${encodeURIComponent(id)}/price`
  },
  appointments: {
    collection: '/api/appointments',
    my: '/api/appointments/my',
    byId: (id: string) => `/api/appointments/${id}`,
    cancel: (id: string) => `/api/appointments/${id}/cancel`,
    confirm: (id: string) => `/api/appointments/${id}/confirm`,
    complete: (id: string) => `/api/appointments/${id}/complete`,
    receptionBookings: '/api/appointments/reception/bookings',
    receptionReschedule: (id: string) => `/api/appointments/reception/${encodeURIComponent(id)}/reschedule`,
    receptionCancel: (id: string) => `/api/appointments/reception/${encodeURIComponent(id)}/cancel`,
    receptionCheckIn: (id: string) => `/api/appointments/reception/${encodeURIComponent(id)}/check-in`,
    receptionQueue: '/api/appointments/reception/queue',
    receptionHistory: '/api/appointments/reception/dashboard/history',
    receptionQueueById: (id: string) => `/api/appointments/reception/queue/${encodeURIComponent(id)}`
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
    cashPayment: (id: string) => `/api/invoices/${encodeURIComponent(id)}/cash-payment`,
    transactions: (id: string) => `/api/invoices/${encodeURIComponent(id)}/transactions`
  },
  notifications: {
    my: '/api/notifications/my',
    preferences: '/api/notifications/my/preferences',
    preference: (type: string) => `/api/notifications/my/preferences/${encodeURIComponent(type)}`,
    byId: (id: string) => `/api/notifications/${encodeURIComponent(id)}`,
    markRead: (id: string) => `/api/notifications/${encodeURIComponent(id)}/read`
  },
  dashboard: {
    me: '/api/dashboard/me'
  }
} as const;
