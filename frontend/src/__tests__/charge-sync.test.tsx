// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {render,screen,cleanup,act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ChargeSyncPanel} from '../components/ChargeSyncPanel';
import {chargeState,deliveryState,type ChargeSyncState} from '../api/billing';
vi.mock('../api/billing',()=>({chargeState:vi.fn(),deliveryState:vi.fn()}));
const props={scope:{token:'synthetic',clinic:'clinic',branch:'branch'},encounterId:'visit',canRetry:false};
const failed:ChargeSyncState={chargeCount:1,events:[{eventId:'event',status:'DLQ',attempts:8,lastError:'SOURCE_PROOF_OR_RECONCILIATION_FAILURE'}]};
beforeEach(()=>vi.resetAllMocks());afterEach(cleanup);
it('retains separate source failures and requires an enabled manager to retry',async()=>{
 vi.mocked(chargeState).mockResolvedValue(failed);vi.mocked(deliveryState).mockImplementation(async(_scope,_id,source)=>{if(source==='medical')throw new Error('Synthetic unavailable');return {events:[]};});
 const retry=vi.fn(),user=userEvent.setup(),view=render(<ChargeSyncPanel {...props} onRetry={retry}/>);await screen.findByRole('alert');expect(screen.getByText('Khoản phí đã ghi nhận: 1')).toBeTruthy();expect(screen.getByText(/không tự lập phiếu/)).toBeTruthy();await user.click(screen.getByRole('button',{name:'Yêu cầu xử lý lại ghi nhận khoản phí'}));expect(retry).not.toHaveBeenCalled();
 view.rerender(<ChargeSyncPanel {...props} canRetry onRetry={retry}/>);await user.click(screen.getByRole('button',{name:'Yêu cầu xử lý lại ghi nhận khoản phí'}));expect(retry).toHaveBeenCalledWith('billing','event');
});
it('clears previously read state on revoke and ignores a late response after changing scope',async()=>{
 vi.mocked(deliveryState).mockResolvedValue({events:[]});vi.mocked(chargeState).mockResolvedValueOnce(failed).mockRejectedValueOnce(new Error('Synthetic revoked'));const view=render(<ChargeSyncPanel {...props}/>);await screen.findByText('Khoản phí đã ghi nhận: 1');await act(async()=>{window.dispatchEvent(new Event('focus'));await new Promise(r=>setTimeout(r,160));});await screen.findByRole('alert');expect(screen.queryByText('Khoản phí đã ghi nhận: 1')).toBeNull();
 let resolve!:(value:ChargeSyncState)=>void;vi.mocked(chargeState).mockReturnValueOnce(new Promise(r=>{resolve=r;})).mockReturnValue(new Promise(()=>{}));await act(async()=>{window.dispatchEvent(new Event("focus"));await new Promise(r=>setTimeout(r,160));});view.rerender(<ChargeSyncPanel {...props} scope={{...props.scope,branch:'other'}}/>);await act(async()=>resolve(failed));expect(screen.queryByText('Khoản phí đã ghi nhận: 1')).toBeNull();
});
