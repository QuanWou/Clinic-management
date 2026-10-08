// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import {PatientHistoryPanel} from '../components/PatientHistoryPanel';
import * as portal from '../api/portal';
import {myAppointments} from '../api/booking';

vi.mock('../api/portal',()=>({ownClinics:vi.fn(),ownMedicalRecords:vi.fn()}));
vi.mock('../api/booking',async original=>({...await original<typeof import('../api/booking')>(),myAppointments:vi.fn()}));
vi.mock('../components/PatientFollowUpPanel',()=>({PatientFollowUpPanel:()=>null}));
vi.mock('../components/PatientFeesPanel',()=>({PatientFeesPanel:()=>null}));

beforeEach(()=>{
 vi.resetAllMocks();
 vi.mocked(portal.ownClinics).mockResolvedValue([{clinicId:'clinic',name:'Synthetic Clinic',branches:[{branchId:'branch',name:'Synthetic Branch',active:true}]}]);
 vi.mocked(myAppointments).mockResolvedValue([]);
});
afterEach(cleanup);

it('shows only patient medical records returned by the released-record endpoint, including reviewed results',async()=>{
 vi.mocked(portal.ownMedicalRecords).mockResolvedValue([{
  encounterId:'encounter',clinicId:'clinic',branchId:'branch',caseVersion:7,savedAt:'2026-10-01T08:00:00Z',
  content:{reasonForVisit:'Sốt và ho',medicalHistory:'Không ghi nhận bệnh nền',allergies:'Không ghi nhận',vitals:'37.8°C',examination:'Họng đỏ nhẹ',preliminaryDiagnosis:'Viêm đường hô hấp trên',conclusion:'Theo dõi viêm hô hấp',instructions:'Uống đủ nước và theo dõi nhiệt độ',followUpDate:'2026-10-08'},
  results:[{name:'Công thức máu',content:'Kết quả đã được bác sĩ duyệt',resultAt:'2026-10-01T07:30:00Z',reviewedAt:'2026-10-01T07:45:00Z'}]
 }]);
 render(<PatientHistoryPanel token="patient-token" patientId="patient" clinicId="clinic" mode="history" onFollowUp={vi.fn(async()=>{})}/>);
 expect(await screen.findByRole('heading',{name:'Hồ sơ khám đã hoàn tất'})).toBeTruthy();
 expect(screen.getByText('Theo dõi viêm hô hấp')).toBeTruthy();
 expect(screen.getByText('Viêm đường hô hấp trên')).toBeTruthy();
 expect(screen.getByText('Kết quả đã được bác sĩ duyệt')).toBeTruthy();
 expect(screen.getByText(/Bác sĩ đã xem/)).toBeTruthy();
 expect(portal.ownMedicalRecords).toHaveBeenCalledWith('patient-token','clinic','branch');
});

it('shows an explicit empty state when no completed validated medical record is released',async()=>{
 vi.mocked(portal.ownMedicalRecords).mockResolvedValue([]);
 render(<PatientHistoryPanel token="patient-token" patientId="patient" clinicId="clinic" mode="history" onFollowUp={vi.fn(async()=>{})}/>);
 expect(await screen.findByText('Chưa có hồ sơ khám nào được phát hành cho bạn.')).toBeTruthy();
 expect(screen.queryByText('Kết quả đã được bác sĩ duyệt')).toBeNull();
});
