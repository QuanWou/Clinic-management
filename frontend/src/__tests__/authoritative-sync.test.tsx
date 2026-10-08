// @vitest-environment jsdom
import {act,cleanup,renderHook} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {useAuthoritativeSync,type SyncContext} from '../components/useAuthoritativeSync';
import type {RealtimeSubscription} from '../api/realtime';

const transport=vi.hoisted(()=>({listeners:[] as Array<{change:()=>void;state:(state:'connected'|'reconnecting'|'disconnected')=>void;denied:()=>void;close:ReturnType<typeof vi.fn>}>}));
vi.mock('../api/realtime',()=>({subscribeRealtime:vi.fn((_subscription:unknown,change:()=>void,state:(state:'connected'|'disconnected'|'reconnecting')=>void,denied:()=>void)=>{const close=vi.fn();transport.listeners.push({change,state,denied,close});return close;})}));
const subscription:RealtimeSubscription={source:'encounter',path:'/scoped/events',token:'synthetic'};
const tick=async(ms=150)=>{await act(async()=>{await vi.advanceTimersByTimeAsync(ms);});};
beforeEach(()=>{vi.useFakeTimers();transport.listeners=[];Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});});
afterEach(()=>{cleanup();vi.useRealTimers();});

it('discards a read that overlaps a completed mutation and refetches after it',async()=>{
 let finish!:()=>void,first!:SyncContext;const refresh=vi.fn().mockImplementationOnce((context:SyncContext)=>{first=context;return new Promise<void>(resolve=>{finish=resolve;});}).mockResolvedValue(undefined);
 const view=renderHook(({blocked})=>useAuthoritativeSync({key:'branch',enabled:true,blocked,subscriptions:[subscription],refresh}),{initialProps:{blocked:false}});
 act(()=>transport.listeners[0].change());await tick();view.rerender({blocked:true});view.rerender({blocked:false});expect(first.current()).toBe(false);
 await act(async()=>finish());await tick();expect(refresh).toHaveBeenCalledTimes(2);
});

it('coalesces duplicate hints, preserves domain targeting and serializes changes during a read',async()=>{
 let finish!:()=>void;
 const refresh=vi.fn().mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;})).mockResolvedValue(undefined);
 renderHook(()=>useAuthoritativeSync({key:'clinic-a',enabled:true,subscriptions:[subscription],refresh}));
 act(()=>{transport.listeners[0].change();transport.listeners[0].change();});await tick();
 expect(refresh).toHaveBeenCalledTimes(1);expect(refresh.mock.calls[0][0].sources).toEqual(['encounter']);
 act(()=>transport.listeners[0].change());await tick();expect(refresh).toHaveBeenCalledTimes(1);
 await act(async()=>finish());await tick();expect(refresh).toHaveBeenCalledTimes(2);
});

it('defers invalidation while a form is dirty and drains the hint when editing finishes',async()=>{
 const refresh=vi.fn().mockResolvedValue(undefined);
 const view=renderHook(({blocked})=>useAuthoritativeSync({key:'patient',enabled:true,blocked,subscriptions:[subscription],refresh}),{initialProps:{blocked:true}});
 act(()=>transport.listeners[0].change());await tick(1000);expect(refresh).not.toHaveBeenCalled();
 view.rerender({blocked:false});await tick();expect(refresh).toHaveBeenCalledTimes(1);
});

it('rejects old-scope responses and cancels subscriptions on clinic or token changes',async()=>{
 const contexts:SyncContext[]=[];
 const refresh=vi.fn(async(context:SyncContext)=>{contexts.push(context);});
 const view=renderHook(({key})=>useAuthoritativeSync({key,enabled:true,subscriptions:[{...subscription,token:key}],refresh}),{initialProps:{key:'clinic-a'}});
 act(()=>transport.listeners[0].change());await tick();expect(contexts[0].current()).toBe(true);
 view.rerender({key:'clinic-b'});expect(contexts[0].current()).toBe(false);expect(transport.listeners[0].close).toHaveBeenCalledTimes(1);
});

it('retries a failed refetch without another hint and catches up on focus and reconnect',async()=>{
 const refresh=vi.fn().mockRejectedValueOnce(new Error('Transient')).mockResolvedValue(undefined);
 renderHook(()=>useAuthoritativeSync({key:'queue',enabled:true,subscriptions:[subscription],refresh}));
 act(()=>transport.listeners[0].change());await tick();await tick(2000);expect(refresh).toHaveBeenCalledTimes(2);
 act(()=>window.dispatchEvent(new Event('focus')));await tick();expect(refresh).toHaveBeenCalledTimes(3);
 act(()=>{transport.listeners[0].state('reconnecting');transport.listeners[0].state('connected');transport.listeners[0].change();});await tick();expect(refresh).toHaveBeenCalledTimes(4);
});

it('suppresses hidden-tab network activity and revalidates once on visibility recovery',async()=>{
 const refresh=vi.fn().mockResolvedValue(undefined);
 renderHook(()=>useAuthoritativeSync({key:'payment',enabled:true,subscriptions:[subscription],refresh}));
 Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});
 act(()=>transport.listeners[0].change());await tick(30000);expect(refresh).not.toHaveBeenCalled();
 Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});act(()=>document.dispatchEvent(new Event('visibilitychange')));await tick();expect(refresh).toHaveBeenCalledTimes(1);
});

it('stops reads after authorization denial and disables fallback on an unmounted page',async()=>{
 const refresh=vi.fn().mockResolvedValue(undefined),denied=vi.fn();
 const view=renderHook(()=>useAuthoritativeSync({key:'billing',enabled:true,subscriptions:[subscription],refresh,onDenied:denied}));
 act(()=>transport.listeners[0].denied());await tick(90000);expect(refresh).not.toHaveBeenCalled();expect(denied).toHaveBeenCalledTimes(1);
 view.unmount();expect(transport.listeners[0].close).toHaveBeenCalledTimes(1);await tick(60000);expect(refresh).not.toHaveBeenCalled();
});

it('does not commit a read if a local edit starts while its request is in flight',async()=>{
 let finish!:()=>void;const committed=vi.fn();
 const refresh=vi.fn(async(context:SyncContext)=>{await new Promise<void>(resolve=>{finish=resolve;});if(context.current())committed();});
 const view=renderHook(({blocked})=>useAuthoritativeSync({key:'draft',enabled:true,blocked,subscriptions:[subscription],refresh}),{initialProps:{blocked:false}});
 act(()=>transport.listeners[0].change());await tick();view.rerender({blocked:true});await act(async()=>finish());expect(committed).not.toHaveBeenCalled();
 view.rerender({blocked:false});await tick();expect(refresh).toHaveBeenCalledTimes(2);
});

