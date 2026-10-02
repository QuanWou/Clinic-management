// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {getSiteClinic} from '../api/booking';
const source={id:'site-clinic',name:'Phòng khám đã công bố',publicDescription:'Thông tin từ nguồn',branches:[{id:'branch',name:'Điểm khám',address:'Địa chỉ từ nguồn',openingHours:'08–17',active:true}]};
afterEach(()=>vi.unstubAllGlobals());
it('opens the sole published clinic without any search request',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({content:[source],totalElements:1}));vi.stubGlobal('fetch',fetcher);
 const clinic=await getSiteClinic('');expect(clinic.clinicId).toBe('site-clinic');expect(clinic.branches[0].branchId).toBe('branch');expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0][0]).toContain('/public/clinics?page=0&size=2');
});
it.each([0,2])('never selects a clinic when the public directory contains %s clinics',async(total)=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({content:total?[source,{...source,id:'other-clinic'}]:[],totalElements:total})));
 await expect(getSiteClinic('')).rejects.toThrow('Trang đặt lịch hiện chưa sẵn sàng');
});
it('does not substitute another clinic when the configured clinic is suspended or missing',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({error:{code:'NOT_FOUND'}},{status:404}));vi.stubGlobal('fetch',fetcher);
 await expect(getSiteClinic('suspended-clinic')).rejects.toMatchObject({status:404});expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0][0]).toContain('/public/clinics/by-id/suspended-clinic');
});
