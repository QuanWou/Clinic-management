import type { DemoDoctor, DemoPatient, UiAppointment, UiInvoice, UiMedicalRecord } from '../types/view';

export const demoPatients: DemoPatient[] = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    userId: '20000000-0000-0000-0000-000000000001',
    name: 'Sarah Lee',
    age: 27,
    gender: 'Female',
    phone: '+1 (888) 123-4567',
    email: 'sarah.lee@email.com',
    address: '123 Main Street, New York, NY 10001',
    bloodType: 'A+',
    status: 'Active',
    lastVisit: '2024-12-13',
    avatar: 'SL',
    emergencyContact: 'David Lee (Father)',
    insuranceProvider: 'Health Plus'
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    userId: '20000000-0000-0000-0000-000000000002',
    name: 'John Max',
    age: 19,
    gender: 'Male',
    phone: '+1 (888) 987-6543',
    email: 'john.max@email.com',
    address: '42 Oak Avenue, Boston, MA',
    bloodType: 'O-',
    status: 'Active',
    lastVisit: '2024-12-12',
    avatar: 'JM',
    emergencyContact: 'Martha Max',
    insuranceProvider: 'Care Shield'
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    userId: '20000000-0000-0000-0000-000000000003',
    name: 'Anna Rose',
    age: 23,
    gender: 'Female',
    phone: '+1 (888) 456-7900',
    email: 'anna.rose@email.com',
    address: '77 Lake Road, Seattle, WA',
    bloodType: 'B+',
    status: 'Active',
    lastVisit: '2024-12-10',
    avatar: 'AR',
    emergencyContact: 'Rose Parker',
    insuranceProvider: 'MediCare'
  },
  {
    id: '10000000-0000-0000-0000-000000000004',
    userId: '20000000-0000-0000-0000-000000000004',
    name: 'Jake Cole',
    age: 35,
    gender: 'Male',
    phone: '+1 (888) 321-0987',
    email: 'jake.cole@email.com',
    address: '15 Pine Lane, Denver, CO',
    bloodType: 'AB+',
    status: 'Active',
    lastVisit: '2024-12-10',
    avatar: 'JC',
    emergencyContact: 'Cole Harper',
    insuranceProvider: 'Prime Health'
  },
  {
    id: '10000000-0000-0000-0000-000000000005',
    userId: '20000000-0000-0000-0000-000000000005',
    name: 'Michael Brown',
    age: 45,
    gender: 'Male',
    phone: '+1 (888) 555-0101',
    email: 'michael.brown@email.com',
    address: '8 Sunset Drive, Austin, TX',
    bloodType: 'A-',
    status: 'Inactive',
    lastVisit: '2024-12-08',
    avatar: 'MB',
    emergencyContact: 'Ella Brown',
    insuranceProvider: 'Family Plan'
  }
];

export const demoDoctors: DemoDoctor[] = [
  {
    id: '30000000-0000-0000-0000-000000000001',
    userId: '40000000-0000-0000-0000-000000000001',
    name: 'Dr. Jane Cooper',
    specialtyName: 'Cardiology',
    department: 'Cardiology Department',
    experience: 8,
    phone: '+1 (888) 987-6543',
    email: 'jane.cooper@clinic.com',
    status: 'Available',
    avatar: 'JC',
    biography: 'Board-certified cardiologist focused on preventive cardiology and heart disease management.',
    consultationFee: 120,
    education: 'MD, Cardiology, Harvard Medical School',
    rating: 4.94,
    totalPatients: 1248,
    languages: ['English', 'Spanish'],
    workingHours: 'Mon - Fri, 09:00 AM - 05:00 PM'
  },
  {
    id: '30000000-0000-0000-0000-000000000002',
    userId: '40000000-0000-0000-0000-000000000002',
    name: 'Dr. Wade Warren',
    specialtyName: 'Neurology',
    department: 'Neurology Department',
    experience: 12,
    phone: '+1 (888) 234-5678',
    email: 'wade.warren@clinic.com',
    status: 'Available',
    avatar: 'WW',
    biography: 'Neurologist specializing in headaches, seizure care, and long-term neurological follow-up.',
    consultationFee: 135,
    education: 'MD, Neurology, Stanford University',
    rating: 4.82,
    totalPatients: 968,
    languages: ['English'],
    workingHours: 'Mon - Thu, 08:00 AM - 04:00 PM'
  },
  {
    id: '30000000-0000-0000-0000-000000000003',
    userId: '40000000-0000-0000-0000-000000000003',
    name: 'Dr. Robert Fox',
    specialtyName: 'Oncology',
    department: 'Oncology Department',
    experience: 10,
    phone: '+1 (888) 345-6789',
    email: 'robert.fox@clinic.com',
    status: 'Available',
    avatar: 'RF',
    biography: 'Oncology specialist with a focus on coordinated cancer care and treatment planning.',
    consultationFee: 160,
    education: 'MD, Oncology, Johns Hopkins',
    rating: 4.76,
    totalPatients: 702,
    languages: ['English', 'French'],
    workingHours: 'Tue - Sat, 10:00 AM - 06:00 PM'
  },
  {
    id: '30000000-0000-0000-0000-000000000004',
    userId: '40000000-0000-0000-0000-000000000004',
    name: 'Dr. Albert Flores',
    specialtyName: 'Orthopedics',
    department: 'Orthopedics Department',
    experience: 15,
    phone: '+1 (888) 456-7890',
    email: 'albert.flores@clinic.com',
    status: 'Unavailable',
    avatar: 'AF',
    biography: 'Orthopedic surgeon focused on sports injury recovery and joint care.',
    consultationFee: 145,
    education: 'MD, Orthopedics, UCLA',
    rating: 4.69,
    totalPatients: 1112,
    languages: ['English'],
    workingHours: 'Mon - Wed, 09:30 AM - 03:30 PM'
  }
];

export const demoAppointments: UiAppointment[] = [
  {
    id: '50000000-0000-0000-0000-000000000001',
    patientId: demoPatients[0].id,
    doctorId: demoDoctors[0].id,
    appointmentDate: '2024-12-13',
    startTime: '11:30:00',
    endTime: '12:00:00',
    status: 'CONFIRMED',
    reason: 'Regular heart checkup and consultation',
    createdAt: '2024-12-10T08:00:00',
    updatedAt: '2024-12-10T08:00:00',
    patientName: demoPatients[0].name,
    doctorName: demoDoctors[0].name,
    department: demoDoctors[0].specialtyName,
    patientAvatar: demoPatients[0].avatar,
    doctorAvatar: demoDoctors[0].avatar
  },
  {
    id: '50000000-0000-0000-0000-000000000002',
    patientId: demoPatients[1].id,
    doctorId: demoDoctors[1].id,
    appointmentDate: '2024-12-12',
    startTime: '11:45:00',
    endTime: '12:15:00',
    status: 'CONFIRMED',
    reason: 'Migraine follow-up',
    createdAt: '2024-12-09T08:00:00',
    updatedAt: '2024-12-09T08:00:00',
    patientName: demoPatients[1].name,
    doctorName: demoDoctors[1].name,
    department: demoDoctors[1].specialtyName,
    patientAvatar: demoPatients[1].avatar,
    doctorAvatar: demoDoctors[1].avatar
  },
  {
    id: '50000000-0000-0000-0000-000000000003',
    patientId: demoPatients[2].id,
    doctorId: demoDoctors[2].id,
    appointmentDate: '2024-12-12',
    startTime: '12:15:00',
    endTime: '12:45:00',
    status: 'PENDING',
    reason: 'Oncology consultation',
    createdAt: '2024-12-08T08:00:00',
    updatedAt: '2024-12-08T08:00:00',
    patientName: demoPatients[2].name,
    doctorName: demoDoctors[2].name,
    department: demoDoctors[2].specialtyName,
    patientAvatar: demoPatients[2].avatar,
    doctorAvatar: demoDoctors[2].avatar
  },
  {
    id: '50000000-0000-0000-0000-000000000004',
    patientId: demoPatients[3].id,
    doctorId: demoDoctors[3].id,
    appointmentDate: '2024-12-11',
    startTime: '13:30:00',
    endTime: '14:00:00',
    status: 'COMPLETED',
    reason: 'Orthopedic assessment',
    createdAt: '2024-12-07T08:00:00',
    updatedAt: '2024-12-11T14:00:00',
    patientName: demoPatients[3].name,
    doctorName: demoDoctors[3].name,
    department: demoDoctors[3].specialtyName,
    patientAvatar: demoPatients[3].avatar,
    doctorAvatar: demoDoctors[3].avatar
  }
];

export const demoMedicalRecords: UiMedicalRecord[] = [
  {
    id: '60000000-0000-0000-0000-000000000001',
    appointmentId: demoAppointments[3].id,
    patientId: demoPatients[3].id,
    doctorId: demoDoctors[3].id,
    symptoms: 'Back pain and difficulty changing posture',
    diagnosis: 'Lumbar strain',
    notes: 'Patient advised rest and intake of anti-inflammatory medication. Follow up after 2 weeks.',
    prescriptions: [
      {
        id: '61000000-0000-0000-0000-000000000001',
        createdAt: '2024-12-11T14:20:00',
        items: [
          {
            id: '62000000-0000-0000-0000-000000000001',
            medicineName: 'Ibuprofen',
            dosage: '400mg',
            frequency: 'Twice daily',
            duration: '5 days',
            note: 'Take after meals'
          }
        ]
      }
    ],
    createdAt: '2024-12-11T14:20:00',
    updatedAt: '2024-12-11T14:20:00',
    patientName: demoPatients[3].name,
    doctorName: demoDoctors[3].name,
    recordType: 'Consultation',
    status: 'Completed'
  }
];

export const demoInvoices: UiInvoice[] = [
  {
    id: '70000000-0000-0000-0000-000000000001',
    patientId: demoPatients[0].id,
    appointmentId: demoAppointments[0].id,
    totalAmount: 150,
    status: 'PAID',
    paymentMethod: 'CARD',
    paidAt: '2024-12-13T12:10:00',
    createdAt: '2024-12-13T12:00:00',
    updatedAt: '2024-12-13T12:10:00',
    patientName: demoPatients[0].name,
    patientAvatar: demoPatients[0].avatar
  },
  {
    id: '70000000-0000-0000-0000-000000000002',
    patientId: demoPatients[1].id,
    appointmentId: demoAppointments[1].id,
    totalAmount: 300,
    status: 'UNPAID',
    paymentMethod: null,
    paidAt: null,
    createdAt: '2024-12-12T12:20:00',
    updatedAt: '2024-12-12T12:20:00',
    patientName: demoPatients[1].name,
    patientAvatar: demoPatients[1].avatar
  },
  {
    id: '70000000-0000-0000-0000-000000000003',
    patientId: demoPatients[3].id,
    appointmentId: demoAppointments[3].id,
    totalAmount: 180,
    status: 'PAID',
    paymentMethod: 'CASH',
    paidAt: '2024-12-11T14:45:00',
    createdAt: '2024-12-11T14:30:00',
    updatedAt: '2024-12-11T14:45:00',
    patientName: demoPatients[3].name,
    patientAvatar: demoPatients[3].avatar
  }
];

export const chartSeries = {
  visitors: [12, 18, 24, 16, 28, 19, 22, 17, 30, 25, 34, 29, 21, 18, 31, 38, 33, 42],
  patients: [20, 24, 31, 35, 38, 30, 25, 21, 24, 28, 34, 42],
  appointments: [12, 14, 16, 13, 18, 21, 17, 15, 14, 18, 24, 19],
  rooms: [8, 11, 10, 14, 16, 12, 10, 15, 13, 17, 12, 19],
  satisfaction: [80, 83, 87, 85, 84, 88, 86, 91, 89, 93, 96, 95]
};
