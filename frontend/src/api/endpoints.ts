export const apiEndpoints = {
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout'
  },
  users: {
    me: '/api/users/me',
    doctorNames: '/api/users/doctors/names',
    adminById: (id: string) => `/api/users/admin/${encodeURIComponent(id)}`
  },
  patients: {
    profile: '/api/patients/profile',
    reception: '/api/patients/reception',
    receptionList: '/api/patients/reception/list',
    receptionByCode: (code: string) => `/api/patients/reception/code/${encodeURIComponent(code)}`,
    receptionById: (id: string) => `/api/patients/reception/${encodeURIComponent(id)}`
  },
  doctors: {
    collection: '/api/doctors',
    profile: '/api/doctors/profile',
    mySchedules: '/api/doctors/profile/schedules',
    schedules: (doctorId: string) => `/api/doctors/${encodeURIComponent(doctorId)}/schedules`,
    availability: (doctorId: string) => `/api/doctors/${encodeURIComponent(doctorId)}/availability`,
    admin: '/api/doctors/admin',
    adminById: (id: string) => `/api/doctors/admin/${encodeURIComponent(id)}`,
    adminSchedules: (id: string) => `/api/doctors/admin/${encodeURIComponent(id)}/schedules`
  },
  specialties: {
    collection: '/api/specialties'
  },
  catalog: {
    services: '/api/catalog/services',
    medicines: '/api/catalog/medicines',
    servicePrices: (id: string) => `/api/catalog/services/${encodeURIComponent(id)}/prices`,
    servicePrice: (id: string) => `/api/catalog/services/${encodeURIComponent(id)}/price`,
    adminServices: '/api/catalog/admin/services',
    adminMedicines: '/api/catalog/admin/medicines',
    adminService: (id: string) => `/api/catalog/admin/services/${encodeURIComponent(id)}`,
    adminMedicine: (id: string) => `/api/catalog/admin/medicines/${encodeURIComponent(id)}`,
    adminServicePrices: (id: string) => `/api/catalog/admin/services/${encodeURIComponent(id)}/prices`
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
    receptionQueueById: (id: string) => `/api/appointments/reception/queue/${encodeURIComponent(id)}`,
    performedServices: (id: string) => `/api/appointments/${encodeURIComponent(id)}/performed-services`,
    performedServiceItem: (id: string, itemId: string) => `/api/appointments/${encodeURIComponent(id)}/performed-services/${encodeURIComponent(itemId)}`,
    performedServicesFinalize: (id: string) => `/api/appointments/${encodeURIComponent(id)}/performed-services/finalize`,
    availability: (doctorId: string) => `/api/appointments/doctors/${encodeURIComponent(doctorId)}/availability`
  },
  medicalRecords: {
    collection: '/api/medical-records',
    my: '/api/medical-records/my',
    doctorMy: '/api/medical-records/doctor/my',
    doctorPatientByCode: (code: string) => `/api/medical-records/doctor/patients/code/${encodeURIComponent(code)}`,
    byId: (id: string) => `/api/medical-records/${id}`,
    byPatient: (patientId: string) => `/api/medical-records/patients/${encodeURIComponent(patientId)}`,
    labOrders: (recordId: string) => `/api/medical-records/${encodeURIComponent(recordId)}/lab-orders`,
    labBillingStatus: (recordId: string) => `/api/medical-records/${encodeURIComponent(recordId)}/lab-orders/billing-status`,
    labOrderStatus: (orderId: string, action: 'sample' | 'processing' | 'result' | 'release') =>
      `/api/medical-records/lab-orders/${encodeURIComponent(orderId)}/${action}`,
    labBillable: (appointmentId: string) => `/api/medical-records/appointments/${encodeURIComponent(appointmentId)}/billable-items`,
    labBillableFinalize: (appointmentId: string) => `/api/medical-records/appointments/${encodeURIComponent(appointmentId)}/billable-items/finalize`
  },
  invoices: {
    collection: '/api/invoices',
    staff: '/api/invoices/staff',
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
