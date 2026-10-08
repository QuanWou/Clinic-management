// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {render,screen,cleanup,act,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {NotificationInbox} from '../components/NotificationInbox';
import * as api from '../api/booking';
const callbacks=vi.hoisted(()=>new Map<string,()=>void>());
vi.mock('../api/booking',()=>({getNotifications:vi.fn(),getUnreadNotificationCount:vi.fn(),markNotificationRead:vi.fn()}));
vi.mock('../api/realtime',()=>({notificationSubscription:(token:string)=>({token,source:'notification'}),subscribeRealtime:(s:{token:string},change:()=>void)=>{callbacks.set(s.token,change);return()=>{callbacks.delete(s.token);};}}));
const row={id:'one',clinic_id:'clinic',kind:'CONFIRMED',message:'A new appointment',created_at:'2026-10-07T01:00:00Z',read_at:null};
beforeEach(()=>{vi.resetAllMocks();callbacks.clear();vi.mocked(api.getNotifications).mockResolvedValue([]);vi.mocked(api.getUnreadNotificationCount).mockResolvedValue({count:0});vi.mocked(api.markNotificationRead).mockResolvedValue({read:true});});afterEach(cleanup);
it('invalidates badge and list without appending duplicates, and persists read state',async()=>{
 const user=userEvent.setup();render(<NotificationInbox token="owner"/>);await waitFor(()=>expect(api.getNotifications).toHaveBeenCalled());
 vi.mocked(api.getNotifications).mockResolvedValue([row]);vi.mocked(api.getUnreadNotificationCount).mockResolvedValue({count:61});
 await act(async()=>{callbacks.get('owner')!();callbacks.get('owner')!();await new Promise(r=>setTimeout(r,150));});
 await user.click(screen.getByRole('button',{name:'Thông báo, 61 chưa đọc'}));expect(screen.getAllByText(row.message)).toHaveLength(1);
 vi.mocked(api.getNotifications).mockResolvedValue([{...row,read_at:'2026-10-07T02:00:00Z'}]);vi.mocked(api.getUnreadNotificationCount).mockResolvedValue({count:60});
 await user.click(screen.getByRole('button',{name:'Đánh dấu đã đọc'}));await screen.findByRole('button',{name:'Thông báo, 60 chưa đọc'});expect(api.markNotificationRead).toHaveBeenCalledWith('owner','one');expect(screen.queryByRole('button',{name:'Đánh dấu đã đọc'})).toBeNull();
});
it('ignores an old account read reply and removes its subscription after switching accounts',async()=>{
 vi.mocked(api.getNotifications).mockResolvedValue([row]);vi.mocked(api.getUnreadNotificationCount).mockResolvedValue({count:1});let finish!:()=>void;vi.mocked(api.markNotificationRead).mockImplementation(()=>new Promise(resolve=>{finish=()=>resolve({read:true});}));
 const user=userEvent.setup(),view=render(<NotificationInbox token="first"/>);await user.click(await screen.findByRole('button',{name:'Thông báo, 1 chưa đọc'}));await user.click(screen.getByRole('button',{name:'Đánh dấu đã đọc'}));
 vi.mocked(api.getNotifications).mockResolvedValue([]);vi.mocked(api.getUnreadNotificationCount).mockResolvedValue({count:0});view.rerender(<NotificationInbox token="second"/>);await act(async()=>finish());await screen.findByRole('button',{name:'Thông báo, 0 chưa đọc'});expect(callbacks.has('first')).toBe(false);expect(screen.queryByText(row.message)).toBeNull();
});
