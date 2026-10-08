// @vitest-environment jsdom
import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import { render,screen,cleanup,act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CashierNotificationPanel } from '../components/CashierNotificationPanel';
import {RequestError} from '../api/booking';
import { notificationState,type NotificationState } from '../api/billing';
vi.mock('../api/billing',()=>({notificationState:vi.fn()}));
const props={scope:{token:'synthetic-cashier',clinic:'clinic',branch:'branch'},billId:'bill',version:0,canRetry:false};
const state:NotificationState={pending:1,delivered:2,manualContact:1,failed:1};
beforeEach(()=>vi.resetAllMocks());afterEach(cleanup);
it('shows pending and manual contact honestly and leaves recovery to an explicitly enabled manager action',async()=>{
 const retry=vi.fn();vi.mocked(notificationState).mockResolvedValue(state);const user=userEvent.setup();const view=render(<CashierNotificationPanel {...props} onRetry={retry}/>);await screen.findByText(/thông báo cần liên hệ trực tiếp/);expect(screen.getByText(/đang chờ giao/)).toBeTruthy();await user.click(screen.getByRole('button',{name:'Yêu cầu giao lại thông báo'}));expect(retry).not.toHaveBeenCalled();view.rerender(<CashierNotificationPanel {...props} onRetry={retry} canRetry/>);await user.click(screen.getByRole('button',{name:'Yêu cầu giao lại thông báo'}));expect(retry).toHaveBeenCalledTimes(1);
});
it('clears a previous scoped delivery result on a denied read',async()=>{
 vi.mocked(notificationState).mockResolvedValueOnce(state).mockRejectedValueOnce(new RequestError('Synthetic next-request membership revoked',403));render(<CashierNotificationPanel {...props}/>);await screen.findByText(/thông báo cần liên hệ trực tiếp/);await act(async()=>{window.dispatchEvent(new Event('focus'));await new Promise(r=>setTimeout(r,160));});expect(screen.queryByText(/thông báo cần liên hệ trực tiếp/)).toBeNull();expect(screen.queryByText(/Đã ghi vào/)).toBeNull();
});
it('ignores a late result after changing session, branch or bill',async()=>{
 let resolve!:(s:NotificationState)=>void;vi.mocked(notificationState).mockReturnValueOnce(new Promise(r=>{resolve=r;})).mockReturnValue(new Promise(()=>{}));const user=userEvent.setup();const view=render(<CashierNotificationPanel {...props}/>);await act(async()=>{window.dispatchEvent(new Event("focus"));await new Promise(r=>setTimeout(r,160));});view.rerender(<CashierNotificationPanel {...props} billId="other-bill" scope={{...props.scope,token:'synthetic-other',branch:'other'}}/>);await act(async()=>resolve(state));expect(screen.queryByText(/Đã ghi vào/)).toBeNull();expect(screen.queryByText(/liên hệ trực tiếp/)).toBeNull();
});
