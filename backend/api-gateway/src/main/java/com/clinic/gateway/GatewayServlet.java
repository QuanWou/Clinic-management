package com.clinic.gateway;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;

/** Fixed internal destinations only; caller credentials remain subject to downstream authorization. */
public final class GatewayServlet extends HttpServlet {
    private final Map<String,String> routes;
    private final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
    static final int MAX_BODY=4*1024*1024;
    static final Set<String> REQUEST_HEADERS=Set.of("authorization","content-type","accept","idempotency-key","if-match","x-request-id","x-auth-channel");
    public GatewayServlet(String json)throws IOException {
        routes=Map.copyOf(new ObjectMapper().readValue(json,new TypeReference<Map<String,String>>(){}));
        for(var value:routes.values()){
            var u=URI.create(value);
            if(!"http".equals(u.getScheme())||!"127.0.0.1".equals(u.getHost())||u.getPort()<1024||u.getUserInfo()!=null||u.getQuery()!=null||u.getFragment()!=null||!u.getPath().matches("/modules/[a-z]+"))throw new IllegalArgumentException("Unsafe gateway destination");
        }
    }
    URI destination(String path,String query){
        if(path==null||!path.startsWith("/s1/")||path.contains("\\")||path.toLowerCase(Locale.ROOT).contains("%2e")||path.toLowerCase(Locale.ROOT).contains("%2f"))return null;
        int end=path.indexOf('/',4);if(end<0)return null;
        String base=routes.get(path.substring(4,end)),tail=path.substring(end);
        if(base==null||!tail.startsWith("/api/")||Arrays.asList(tail.split("/",-1)).contains("..")||Arrays.asList(tail.split("/",-1)).contains("."))return null;
        return URI.create(base+tail+(query==null?"":"?"+query));
    }
    @Override protected void service(HttpServletRequest req,HttpServletResponse res)throws IOException {
        URI destination;
        try{destination=destination(req.getRequestURI(),req.getQueryString());}catch(IllegalArgumentException e){res.sendError(400);return;}
        if(destination==null){res.sendError(404);return;}
        if(!Set.of("GET","POST","PUT","PATCH","DELETE","OPTIONS","HEAD").contains(req.getMethod())){res.sendError(405);return;}
        if(req.getContentLengthLong()>MAX_BODY){res.sendError(413);return;}
        byte[] bytes=req.getInputStream().readNBytes(MAX_BODY+1);if(bytes.length>MAX_BODY){res.sendError(413);return;}
        var outgoing=HttpRequest.newBuilder(destination).timeout(Duration.ofSeconds(30)).method(req.getMethod(),HttpRequest.BodyPublishers.ofByteArray(bytes));
        boolean authRoute=req.getRequestURI().startsWith("/s1/auth/");
        for(String h:Collections.list(req.getHeaderNames())){
            String lower=h.toLowerCase(Locale.ROOT);
            if(REQUEST_HEADERS.contains(lower)||(authRoute&&"cookie".equals(lower)))outgoing.header(h,req.getHeader(h));
        }
        try{
            var response=client.send(outgoing.build(),HttpResponse.BodyHandlers.ofInputStream());
            res.setStatus(response.statusCode());
            for(String h:List.of("content-type","cache-control","etag","retry-after","content-disposition"))response.headers().firstValue(h).ifPresent(v->res.setHeader(h,v));
            if(authRoute)for(String cookie:response.headers().allValues("set-cookie"))res.addHeader("Set-Cookie",cookie);
            res.setHeader("X-Content-Type-Options","nosniff");
            try(var body=response.body()){
                if(response.headers().firstValue("content-type").orElse("").startsWith("text/event-stream")){
                    res.setHeader("X-Accel-Buffering","no");byte[] chunk=new byte[4096];int count;
                    while((count=body.read(chunk))!=-1){res.getOutputStream().write(chunk,0,count);res.flushBuffer();}
                }else body.transferTo(res.getOutputStream());
            }
        }catch(InterruptedException e){Thread.currentThread().interrupt();res.sendError(503);}catch(IOException e){if(!res.isCommitted())res.sendError(502,"Service unavailable");}
    }
}
