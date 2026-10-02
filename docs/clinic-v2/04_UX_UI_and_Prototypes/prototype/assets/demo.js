/* CMV2 static UX prototype. Synthetic data, no server, no authorization or payments. */
(()=>{
const KEY='cmv2-phase04-demo-v1';
const clinics=[
{id:'CL-001',slug:'an-binh-demo',name:'Phòng khám Đa khoa An Bình (mô phỏng)',branch:'Cơ sở Trung tâm',address:'Quận trung tâm · Địa chỉ minh họa',specialties:['Nội tổng quát','Nhi khoa','Da liễu'],doctor:'BS. Nguyễn Minh An (mẫu)',fee:250000,verified:true,hours:'07:30 – 17:30',phone:'Số liên hệ minh họa',description:'Khám ngoại trú đa khoa, xét nghiệm cơ bản và tư vấn tái khám. Đây là hồ sơ thiết kế giả lập, không phải cơ sở đang hoạt động.'},
{id:'CL-002',slug:'minh-tam-demo',name:'Phòng khám Minh Tâm (mô phỏng)',branch:'Cơ sở 01',address:'Khu vực phía Tây · Địa chỉ minh họa',specialties:['Nội tổng quát','Tai Mũi Họng'],doctor:'BS. Lê Hà Linh (mẫu)',fee:280000,verified:true,hours:'08:00 – 17:00',phone:'Số liên hệ minh họa',description:'Hồ sơ mẫu minh họa bộ lọc tìm kiếm và giao diện chi tiết công khai.'},
{id:'CL-003',slug:'chua-cong-bo-demo',name:'Phòng khám chưa được duyệt (mô phỏng)',branch:'Cơ sở thử nghiệm',address:'Không công bố',specialties:['Nội tổng quát'],doctor:'',fee:200000,verified:false,hours:'',phone:'',description:'Not public.'}
];
const init=()=>({v:1,seq:4,branch:'BR-001',role:'manager',appointments:[{id:'LH-DEMO-001',patientCode:'BN-DEMO-001',patient:'Nguyễn An (mẫu)',phone:'0900 000 001',clinicId:'CL-001',branch:'BR-001',doctor:'BS. Nguyễn Minh An (mẫu)',service:'Khám Nội tổng quát',date:'2026-09-30',time:'09:00',status:'confirmed',deposit:0,fee:250000},{id:'LH-DEMO-002',patientCode:'BN-DEMO-002',patient:'Trần Bình (mẫu)',phone:'0900 000 002',clinicId:'CL-001',branch:'BR-001',doctor:'BS. Nguyễn Minh An (mẫu)',service:'Khám Nội tổng quát',date:'2026-09-30',time:'09:30',status:'checked_in',deposit:0,fee:250000,owned:true}],visits:[{id:'LK-DEMO-001',appointmentId:'LH-DEMO-002',clinicId:'CL-001',patientCode:'BN-DEMO-002',patient:'Trần Bình (mẫu)',branch:'BR-001',doctor:'BS. Nguyễn Minh An (mẫu)',time:'09:30',queue:'STT-002',status:'waiting',note:'',diagnosis:'',order:'',result:'',reviewed:false,prescription:'',signed:false,released:false,serviceFee:250000,bill:250000,paid:0,paymentLog:[],owned:true}],platformClinicStatus:'submitted'});
let memory=init();
function load(){try{const s=localStorage.getItem(KEY);if(s){let parsed=JSON.parse(s);if(parsed?.v===1&&Array.isArray(parsed.appointments))return parsed;}else{localStorage.setItem(KEY,JSON.stringify(memory));}}catch(e){}return memory;}
function save(s){memory=s;try{localStorage.setItem(KEY,JSON.stringify(s));}catch(e){}window.dispatchEvent(new Event('demochange'));}
function reset(){save(init());}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Number(n||0).toLocaleString('vi-VN')+' ₫';
const date=s=>{const x=(s||'').split('-');return x.length===3?x.reverse().join('/'):s};
const status=s=>({confirmed:['Đã xác nhận','ok'],pending:['Chờ xác nhận','pending'],checked_in:['Đã tiếp nhận','progress'],canceled:['Đã hủy','danger'],waiting:['Chờ khám','pending'],in_progress:['Đang khám','progress'],awaiting_results:['Chờ kết quả','pending'],clinically_completed:['Hoàn tất chuyên môn','ok'],signed:['Đã xác nhận bệnh án','ok'],completed:['Hoàn thành','ok']}[s]||[s,'']);
const badge=s=>{let [v,c]=status(s);return `<span class="pill ${c}">${v}</span>`};
const toast=(message,type='success')=>{const el=document.getElementById('toast');if(!el)return;el.textContent=message;el.style.background=type==='error'?'#892b33':'#173c3a';el.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>el.classList.remove('show'),4300)};
const header=(title,description,actions='')=>`<div class="page-heading"><div><div class="eyebrow">CLINICCARE · TRẢI NGHIỆM MẪU</div><h1>${title}</h1><p>${description}</p></div><div class="button-row">${actions}</div></div>`;
window.CM={KEY,clinics,load,save,reset,esc,money,date,status,badge,toast,header};
})();
