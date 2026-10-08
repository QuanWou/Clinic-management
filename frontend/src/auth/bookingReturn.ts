export type BookingReturnState={
 branch:string;
 specialty:string;
 specialtyCode?:string;
 offering:string;
 doctorMode:'recommended'|'specific';
 doctor:string;
 date:string;
 slotId:string;
 slotDoctorId:string;
 slotOfferingId:string;
 slotStartsAt:string;
};

const key='clinic.patient.booking-return.v1';

export function saveBookingReturnState(state:BookingReturnState){
 try{sessionStorage.setItem(key,JSON.stringify(state));}catch{/* In-memory booking still remains until navigation. */}
}

export function readBookingReturnState():BookingReturnState|null{
 try{
  const raw=sessionStorage.getItem(key);
  if(!raw)return null;
  const value=JSON.parse(raw) as Partial<BookingReturnState>;
  if(!value.specialty||!value.offering||!value.date||!value.slotId)return null;
  if(value.doctorMode!=='recommended'&&value.doctorMode!=='specific')return null;
  return {
   branch:String(value.branch??''),
   specialty:String(value.specialty),
   specialtyCode:value.specialtyCode?String(value.specialtyCode):undefined,
   offering:String(value.offering),
   doctorMode:value.doctorMode,
   doctor:String(value.doctor??''),
   date:String(value.date),
   slotId:String(value.slotId),
   slotDoctorId:String(value.slotDoctorId??''),
   slotOfferingId:String(value.slotOfferingId??value.offering),
   slotStartsAt:String(value.slotStartsAt??''),
  };
 }catch{return null;}
}

export function clearBookingReturnState(){
 try{sessionStorage.removeItem(key);}catch{/* no-op */}
}
