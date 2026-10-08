// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {SupervisorArrivalPanel} from '../components/SupervisorArrivalPanel';
import {OvernightQueuePanel} from '../components/OvernightQueuePanel';
import * as api from '../api/reception';
vi.mock('../api/reception',()=>({pendingArrivals:vi.fn(),superviseArrival:vi.fn(),rollForward:vi.fn()}));
const scope={token:'synthetic-token',clinic:'clinic',branch:'branch'},pending={id:'visit',appointmentId:'booking',status:'ARRIVAL_PENDING',version:0,ticket:null};
beforeEach(()=>{vi.resetAllMocks();vi.mocked(api.pendingArrivals).mockResolvedValue({items:[pending],nextAfter:null});vi.mocked(api.superviseArrival).mockResolvedValue({...pending,status:'WAITING',version:2});});afterEach(cleanup);
it('supervisor locks the original recovery after a lost reply and retains one visit',async()=>{
 const user=userEvent.setup(),parent=vi.fn();vi.mocked(api.superviseArrival).mockRejectedValueOnce(new Error('Synthetic lost source ACK'));render(<SupervisorArrivalPanel scope={scope} active canManage onPending={parent}/>);await screen.findByText('Đang chờ xác nhận lịch đến khám');await user.type(screen.getByLabelText('Lý do quản lý phục hồi tiếp nhận'),'Synthetic staff left shift');await user.click(screen.getByRole('button',{name:'Phục hồi lượt visit'}));await screen.findByRole('alert');expect(screen.getByLabelText('Lý do quản lý phục hồi tiếp nhận').closest('fieldset')?.disabled).toBe(true);await user.click(screen.getByRole('button',{name:'Thử lại phục hồi đang chờ'}));await screen.findByText(/phục hồi cùng lượt/);expect(vi.mocked(api.superviseArrival).mock.calls[0]).toEqual(vi.mocked(api.superviseArrival).mock.calls[1]);expect(parent).toHaveBeenLastCalledWith(false);expect(screen.queryByRole('button',{name:'Phục hồi lượt visit'})).toBeNull();
});
it('reception cannot view supervisor actions and scoped reads ignore late responses',async()=>{
 const user=userEvent.setup();const view=render(<SupervisorArrivalPanel scope={scope} active canManage={false} onPending={()=>{}}/>);expect(screen.queryByRole('button')).toBeNull();let finish!:(v:api.PendingPage)=>void;vi.mocked(api.pendingArrivals).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));view.rerender(<SupervisorArrivalPanel scope={scope} active canManage onPending={()=>{}}/>);view.rerender(<SupervisorArrivalPanel scope={{...scope,branch:'other'}} canManage onPending={()=>{}}/>);finish({items:[pending],nextAfter:null});await screen.findByText('Lượt tiếp nhận đang chờ xác nhận');expect(screen.queryByText(/Mã lượt: visit/)).toBeNull();
});
it('prior-day queue advance retries exact ticket version and explains the preserved encounter',async()=>{
 const user=userEvent.setup();const ticket={id:'old-ticket',visitId:'visit',servicePointId:'room',date:'2000-01-01',number:1,code:'SYN-OLD',state:'WAITING',version:3};vi.mocked(api.rollForward).mockRejectedValueOnce(new Error('Synthetic unknown')).mockResolvedValue({...ticket,id:'new-ticket',date:'2026-10-02',code:'SYN-TODAY',version:0});render(<OvernightQueuePanel scope={scope} tickets={[ticket]} onPending={()=>{}}/>);await user.type(screen.getByLabelText('Lý do chuyển lượt chờ sang hôm nay'),'Synthetic patient has returned');await user.click(screen.getByRole('button',{name:'Chuyển SYN-OLD sang hôm nay'}));await screen.findByRole('alert');await user.click(screen.getByRole('button',{name:'Thử lại chuyển hàng đợi đang chờ'}));await screen.findByText(/cùng lượt sang hàng đợi hôm nay: SYN-TODAY/);expect(screen.queryByRole('button',{name:'Chuyển SYN-OLD sang hôm nay'})).toBeNull();expect(vi.mocked(api.rollForward).mock.calls[0]).toEqual(vi.mocked(api.rollForward).mock.calls[1]);expect(vi.mocked(api.rollForward).mock.calls[0][2]).toEqual({expectedVersion:3,reason:'Synthetic patient has returned'});
});

