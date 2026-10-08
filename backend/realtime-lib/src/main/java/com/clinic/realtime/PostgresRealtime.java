package com.clinic.realtime;

import jakarta.servlet.http.HttpServletResponse;
import org.postgresql.PGConnection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.function.Predicate;

/** Commit-only invalidation transport. One LISTEN connection per module, not per browser.
 * Channels are selected exclusively by the authenticated owner controller. No DB payload is forwarded.
 */
public final class PostgresRealtime implements AutoCloseable {
 private static final Logger log=LoggerFactory.getLogger(PostgresRealtime.class);
 private final DataSource dataSource;
 private final ConcurrentMap<String,Signal> signals=new ConcurrentHashMap<>();
 private final AtomicBoolean closed=new AtomicBoolean();
 private final AtomicLong epoch=new AtomicLong();
 private volatile Thread worker;
 private volatile Connection connection;
 private static final class Signal {
  final AtomicInteger readers=new AtomicInteger();final AtomicLong version=new AtomicLong();
  volatile long listeningEpoch;
 }
 public PostgresRealtime(DataSource dataSource){this.dataSource=dataSource;}
 public static String channel(String domain,Object... scope){
  if(!domain.matches("[a-z_]{1,25}"))throw new IllegalArgumentException("Invalid domain");
  try{return domain+"_"+HexFormat.of().formatHex(MessageDigest.getInstance("MD5").digest(String.join(":",Arrays.stream(scope).map(Object::toString).toList()).getBytes(StandardCharsets.UTF_8)));}
  catch(java.security.NoSuchAlgorithmException e){throw new IllegalStateException(e);}
 }
 private synchronized void start(){
  if(closed.get())throw new IllegalStateException("Realtime stopped");
  if(worker==null||!worker.isAlive())worker=Thread.startVirtualThread(this::listen);
 }
 private void listen(){
  long retry=1000;
  while(!closed.get()){
   if(signals.isEmpty()){try{Thread.sleep(1000);}catch(InterruptedException e){Thread.currentThread().interrupt();return;}continue;}
   try(var db=dataSource.getConnection();var statement=db.createStatement()){
    connection=db;db.setAutoCommit(true);var pg=db.unwrap(PGConnection.class);var subscribed=new HashSet<String>();long current=epoch.incrementAndGet();
    log.debug("Realtime listener connected");retry=1000;
    try{while(!closed.get()&&!signals.isEmpty()){
     for(String key:new HashSet<>(subscribed))if(!signals.containsKey(key)){statement.execute("UNLISTEN "+key);subscribed.remove(key);}
     for(var entry:signals.entrySet()){if(subscribed.add(entry.getKey()))statement.execute("LISTEN "+entry.getKey());entry.getValue().listeningEpoch=current;}
     var notifications=pg.getNotifications(1000);
     if(notifications!=null)for(var event:notifications){var signal=signals.get(event.getName());if(signal!=null)signal.version.incrementAndGet();}
    }}finally{statement.execute("UNLISTEN *");}
   }catch(Exception e){
    // Do not include DB credentials, channel identifiers or notification payloads in diagnostics.
    if(!closed.get()){log.warn("Realtime listener unavailable; recovering ({})",e.getClass().getSimpleName());for(var signal:signals.values())signal.listeningEpoch=0;}
    try{Thread.sleep(retry);}catch(InterruptedException ex){Thread.currentThread().interrupt();return;}retry=Math.min(30000,retry*2);
   }finally{connection=null;}
  }
 }
 public SseEmitter subscribe(String channel,Runnable authorize,HttpServletResponse response,Predicate<RuntimeException> denied){
  if(!channel.matches("[a-z_]{1,25}_[a-f0-9]{32}"))throw new IllegalArgumentException("Invalid channel");
  authorize.run();response.setHeader("Cache-Control","no-store");response.setHeader("X-Accel-Buffering","no");
  var emitter=new SseEmitter(65000L);var active=new AtomicBoolean(true);
  var signal=signals.compute(channel,(key,existing)->{var value=existing==null?new Signal():existing;value.readers.incrementAndGet();return value;});
  Runnable release=()->{if(active.getAndSet(false))signals.computeIfPresent(channel,(key,value)->value.readers.decrementAndGet()==0?null:value);};
  emitter.onCompletion(release);emitter.onTimeout(release);emitter.onError(e->release.run());start();
  Thread.startVirtualThread(()->{
   long seen=-1,readyEpoch=0,nextCheck=0,end=System.nanoTime()+55_000_000_000L;
   try{while(active.get()&&!closed.get()&&System.nanoTime()<end){
    long now=System.nanoTime(),version=signal.version.get(),listening=signal.listeningEpoch;
    if(listening!=0&&(listening!=readyEpoch||version!=seen||now>=nextCheck)){
     try{authorize.run();}catch(RuntimeException failure){if(!denied.test(failure))throw failure;log.info("Realtime subscription authorization failed");emitter.send(SseEmitter.event().name("denied").data("refetch"));break;}
     if(listening!=readyEpoch){emitter.send(SseEmitter.event().name("ready").data("refetch"));readyEpoch=listening;}
     else if(version!=seen)emitter.send(SseEmitter.event().name("changed").data("refetch"));
     else emitter.send(SseEmitter.event().comment("keepalive"));
     seen=version;nextCheck=now+10_000_000_000L;
    }
    Thread.sleep(100);
   }emitter.complete();}
   catch(Exception e){if(active.get())log.debug("Realtime client delivery ended ({})",e.getClass().getSimpleName());emitter.completeWithError(e);}
   finally{release.run();}
  });return emitter;
 }
 @Override public void close(){closed.set(true);if(worker!=null)worker.interrupt();var db=connection;if(db!=null)try{db.close();}catch(Exception ignored){}signals.clear();}
}
