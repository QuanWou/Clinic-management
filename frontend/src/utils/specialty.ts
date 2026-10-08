export const specialtyNames:Record<string,string>={
 CARD:'Tim mạch',
 DERM:'Da liễu',
 DIAG:'Chẩn đoán',
 ENT:'Tai mũi họng',
 FAMILY:'Y học gia đình',
 GEN:'Nội tổng quát',
 LAB:'Xét nghiệm',
 NEURO:'Thần kinh',
 ONC:'Ung bướu',
 ORTHO:'Cơ xương khớp',
 PED:'Nhi khoa',
 QA:'Kiểm thử giao diện',
 'QA.INTERNAL':'Kiểm thử nội bộ'
};

export const specialtyOptions=[
 {value:'GEN',label:'Nội tổng quát'},
 {value:'FAMILY',label:'Y học gia đình'},
 {value:'CARD',label:'Tim mạch'},
 {value:'PED',label:'Nhi khoa'},
 {value:'NEURO',label:'Thần kinh'},
 {value:'ORTHO',label:'Cơ xương khớp'},
 {value:'ONC',label:'Ung bướu'},
 {value:'DERM',label:'Da liễu'},
 {value:'ENT',label:'Tai mũi họng'},
 {value:'DIAG',label:'Chẩn đoán'},
 {value:'LAB',label:'Xét nghiệm'},
 {value:'QA',label:'Kiểm thử giao diện'},
 {value:'QA.INTERNAL',label:'Kiểm thử nội bộ'}
];

export function specialtyName(code?:string|null,fallback?:string|null){
 const normalized=code?.trim().toUpperCase();
 if(!normalized)return fallback?.trim()||'';
 return specialtyNames[normalized]??fallback?.trim()??normalized;
}

export function specialtyDisplay(code?:string|null,fallback?:string|null){
 const name=specialtyName(code,fallback);
 const normalized=code?.trim().toUpperCase();
 if(!name)return 'Chưa gán';
 return normalized&&name.toUpperCase()!==normalized?name:name;
}
