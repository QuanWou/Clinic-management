import {dateLabel} from '../utils/display';
export type PatientSummary={patientId:string;patientCode:string;fullName:string;dateOfBirth:string|null};
export function patientLabel(patient?:PatientSummary|null){return patient?`${patient.fullName} · ${patient.dateOfBirth?dateLabel(patient.dateOfBirth):'Chưa rõ ngày sinh'}`:'Chưa có thông tin nhận diện';}
export function PatientIdentity({patient}:{patient?:PatientSummary|null}){
 return <div className="patient-identity">{patient?<><strong>{patient.fullName}</strong><span>Ngày sinh: {patient.dateOfBirth?dateLabel(patient.dateOfBirth):'Chưa ghi nhận'}</span></>:<span role="status">Chưa có thông tin nhận diện bệnh nhân. Hãy đồng bộ dữ liệu trước khi thao tác.</span>}</div>;
}
