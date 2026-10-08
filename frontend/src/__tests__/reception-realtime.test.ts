// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {subscribeReception} from '../api/realtime';

const scope={token:'synthetic-secret',clinic:'clinic-a',branch:'branch-a'};
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});

it('reads split SSE frames, refetches on reconnect, and cancels the old subscription',async()=>{
 vi.useFakeTimers();let first:ReadableStreamDefaultController<Uint8Array>,second:ReadableStreamDefaultController<Uint8Array>;
 const fetcher=vi.fn().mockResolvedValueOnce(new Response(new ReadableStream({start(c){first=c;}}),{headers:{'Content-Type':'text/event-stream'}})).mockResolvedValueOnce(new Response(new ReadableStream({start(c){second=c;}}),{headers:{'Content-Type':'text/event-stream'}}));
 vi.stubGlobal('fetch',fetcher);const changed=vi.fn(),status=vi.fn(),denied=vi.fn();
 const close=subscribeReception(scope,'encounter',changed,status,denied);await flush();
 const bytes=new TextEncoder();first!.enqueue(bytes.encode('event: rea'));first!.enqueue(bytes.encode('dy\r\ndata: refetch\r\n\r\n: keepalive\n\n'));await flush();
 expect(changed).toHaveBeenCalledTimes(1);expect(status).toHaveBeenLastCalledWith('connected');
 expect(fetcher.mock.calls[0][0]).not.toContain(scope.token);expect(fetcher.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${scope.token}`);
 first!.close();await flush();expect(status).toHaveBeenLastCalledWith('reconnecting');
 await vi.advanceTimersByTimeAsync(1000);second!.enqueue(bytes.encode('event: ready\ndata: refetch\n\n'));await flush();
 expect(changed).toHaveBeenCalledTimes(2);expect(fetcher).toHaveBeenCalledTimes(2);
 close();expect(fetcher.mock.calls[1][1].signal.aborted).toBe(true);await vi.advanceTimersByTimeAsync(60000);expect(fetcher).toHaveBeenCalledTimes(2);expect(denied).not.toHaveBeenCalled();
});

it('stops retries and clears authorized state when branch permission is denied',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn().mockResolvedValue(new Response('{}',{status:403}));vi.stubGlobal('fetch',fetcher);
 const denied=vi.fn(),changed=vi.fn();const close=subscribeReception(scope,'billing',changed,vi.fn(),denied);await flush();await vi.advanceTimersByTimeAsync(60000);
 expect(denied).toHaveBeenCalledTimes(1);expect(changed).not.toHaveBeenCalled();expect(fetcher).toHaveBeenCalledTimes(1);close();
});

it('does not treat a gateway JSON response as a connected stream',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn().mockResolvedValue(new Response('{}',{headers:{'Content-Type':'application/json'}}));vi.stubGlobal('fetch',fetcher);
 const changed=vi.fn(),status=vi.fn();const close=subscribeReception(scope,'appointment',changed,status,vi.fn());await flush();
 expect(status).toHaveBeenLastCalledWith('reconnecting');expect(changed).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1000);expect(fetcher).toHaveBeenCalledTimes(2);close();
});

it('shares a scoped connection and closes it only when its last consumer leaves',async()=>{
 let stream!:ReadableStreamDefaultController<Uint8Array>;const fetcher=vi.fn().mockResolvedValue(new Response(new ReadableStream({start(c){stream=c;}}),{headers:{'Content-Type':'text/event-stream'}}));vi.stubGlobal('fetch',fetcher);
 const a=vi.fn(),b=vi.fn();const closeA=subscribeReception(scope,'billing',a,vi.fn(),vi.fn());const closeB=subscribeReception(scope,'billing',b,vi.fn(),vi.fn());await flush();
 stream.enqueue(new TextEncoder().encode('event: ready\ndata: refetch\n\n'));await flush();expect(fetcher).toHaveBeenCalledTimes(1);expect(a).toHaveBeenCalledTimes(1);expect(b).toHaveBeenCalledTimes(1);
 closeA();expect(fetcher.mock.calls[0][1].signal.aborted).toBe(false);stream.enqueue(new TextEncoder().encode('event: changed\ndata: refetch\n\n'));await flush();expect(a).toHaveBeenCalledTimes(1);expect(b).toHaveBeenCalledTimes(2);
 closeB();expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
});

it('recovers an idle transport even when the network never closes it',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn().mockImplementation(async()=>new Response(new ReadableStream({start(){}}),{headers:{'Content-Type':'text/event-stream'}}));vi.stubGlobal('fetch',fetcher);
 const close=subscribeReception(scope,'medical',vi.fn(),vi.fn(),vi.fn());await flush();await vi.advanceTimersByTimeAsync(46000);await flush();expect(fetcher).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);close();
});
