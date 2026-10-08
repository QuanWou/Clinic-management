// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {PatientClinicalRecords} from '../components/PatientClinicalRecords';
import * as api from '../api/patientClinicalRecords';
import {affiliations,type Clinic} from '../api/configuration';
vi.mock('../api/patientClinicalRecords',()=>({visits:vi.fn(),record:vi.fn()}));
vi.mock('../api/configuration',()=>({affiliations:vi.fn()}));
const visit:api.PatientVisit={encounterId:'visit',visitCode:'A-001',doctorId:'doctor',status:'CLINICALLY_COMPLETED',createdAt:'2026-10-01T08:00:00Z',checkedInAt:'2026-10-01T08:00:00Z',completedAt:'2026-10-01T09:00:00Z',serviceName:'Khám tổng quát',walkIn:true};
const record:api.ClinicalRecord={encounterId:'visit',status:'VALIDATED',documentVersion:2,savedAt:'2026-10-01T09:00:00Z',authorUserId:'doctor-user',content:{reasonForVisit:'Đau đầu',medicalHistory:'Tiền sử ghi nhận',allergies:'Dị ứng ghi nhận',vitals:'120/80',examination:'Khám lâm sàng ghi nhận',preliminaryDiagnosis:'Chẩn đoán ghi nhận',conclusion:'Kết luận ghi nhận',instructions:'Hướng dẫn điều trị',followUpDate:'2026-10-15'},orders:[{id:'order',name:'Công thức máu',state:'RESULTED',orderedAt:'2026-10-01T08:30:00Z',result:'Kết quả xét nghiệm đã lưu',resultAt:'2026-10-01T08:40:00Z',reviewedAt:null}]};
const clinic={id:'clinic',branches:[{id:'branch',name:'Cơ sở 1',active:true},{id:'other',name:'Cơ sở 2',active:false}]} as Clinic;
beforeEach(()=>{vi.resetAllMocks();vi.mocked(api.visits).mockResolvedValue({content:[visit],totalElements:1,totalPages:1,number:0,size:20});vi.mocked(api.record).mockResolvedValue(record);vi.mocked(affiliations).mockResolvedValue([{practitionerId:'doctor',displayName:'Bác sĩ An'}] as Awaited<ReturnType<typeof affiliations>>);});
afterEach(cleanup);
const open=()=>{render(<PatientClinicalRecords patientId="walk-in-patient" session={{token:'admin',clinic:'clinic',branch:'branch'}} clinic={clinic} disabled={false} revision={0}/>);return userEvent.setup();};
it('loads history for the actual walk-in patient and opens complete clinical content',async()=>{
 const user=open();await screen.findByRole('table',{name:'Lịch sử khám bệnh nhân'});await user.click(screen.getByRole('button',{name:'Xem bệnh án A-001'}));await screen.findByText('Chẩn đoán ghi nhận');expect(screen.getByText('Tiền sử ghi nhận')).toBeTruthy();expect(screen.getByText('Kết quả xét nghiệm đã lưu')).toBeTruthy();expect(screen.getByText('Có kết quả, chờ bác sĩ xem')).toBeTruthy();expect(screen.getByRole('heading',{name:'Bệnh án đã xác nhận'})).toBeTruthy();expect(api.record).toHaveBeenCalledWith(expect.objectContaining({clinic:'clinic',branch:'branch'}),'walk-in-patient','visit');
});
it('labels drafts and handles a visit without a saved medical record',async()=>{
 const user=open();await screen.findByRole('button',{name:'Xem bệnh án A-001'});vi.mocked(api.record).mockResolvedValue({...record,status:'OPEN'});await user.click(screen.getByRole('button',{name:'Xem bệnh án A-001'}));await screen.findByRole('heading',{name:'Bản nháp bệnh án'});await user.click(screen.getByRole('button',{name:'Về lịch sử khám'}));vi.mocked(api.record).mockResolvedValue(null);await user.click(screen.getByRole('button',{name:'Xem bệnh án A-001'}));await screen.findByText('Lượt khám này chưa có bệnh án được lưu.');
});
it('clears previous clinical details when switching branch including inactive branches',async()=>{
 const user=open();await screen.findByRole('button',{name:'Xem bệnh án A-001'});await user.click(screen.getByRole('button',{name:'Xem bệnh án A-001'}));await screen.findByText('Chẩn đoán ghi nhận');vi.mocked(api.visits).mockResolvedValue({content:[],totalElements:0,totalPages:0,number:0,size:20});await user.selectOptions(screen.getByLabelText('Cơ sở trong lịch sử khám'),'other');await screen.findByText('Bệnh nhân chưa có lượt khám tại cơ sở này.');expect(screen.queryByText('Chẩn đoán ghi nhận')).toBeNull();await waitFor(()=>expect(api.visits).toHaveBeenLastCalledWith(expect.objectContaining({branch:'other'}),'walk-in-patient',0));
});
it('shows dependency or permission errors separately from empty history',async()=>{
 vi.mocked(api.visits).mockRejectedValue(new Error('Quyền truy cập đã thay đổi'));open();await screen.findByRole('alert');expect(screen.queryByText('Bệnh nhân chưa có lượt khám tại cơ sở này.')).toBeNull();
});
