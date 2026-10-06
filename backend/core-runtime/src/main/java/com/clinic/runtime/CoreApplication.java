package com.clinic.runtime;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import org.apache.catalina.connector.Connector;
import org.apache.catalina.core.StandardHost;
import org.apache.catalina.startup.Tomcat;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.actuate.health.HealthEndpoint;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServer;
import org.springframework.boot.web.servlet.ServletContextInitializer;
import org.springframework.boot.web.servlet.server.ServletWebServerFactory;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.support.GenericApplicationContext;

/** One deployment, JVM and HTTP listener; domain modules retain isolated security and DB roles. */
public final class CoreApplication {
    public record Module(String name,String application) {}
    public record Manifest(String name,List<Module> modules) {}
    public static void main(String[] args)throws Exception {
        var loader=Thread.currentThread().getContextClassLoader();
        Manifest manifest;
        try(var in=Objects.requireNonNull(loader.getResourceAsStream("core-manifest.json"))){manifest=new ObjectMapper().readValue(in,Manifest.class);}
        int port=Integer.parseInt(required("CORE_PORT"));
        if(port<1024||port>65535)throw new IllegalArgumentException("Invalid core port");
        var tomcat=new Tomcat();
        var base=Path.of(required("CORE_BASE")).toAbsolutePath();Files.createDirectories(base);
        tomcat.setBaseDir(base.toString());
        var contexts=new ArrayList<ConfigurableApplicationContext>();
        var root=tomcat.addContext("",base.toString());root.setParentClassLoader(loader);
        Tomcat.addServlet(root,"health",new HttpServlet(){
            @Override protected void doGet(HttpServletRequest req,HttpServletResponse res)throws IOException {
                boolean up=contexts.size()==manifest.modules().size()&&contexts.stream().allMatch(c->c.isActive()&&"UP".equals(c.getBean(HealthEndpoint.class).health().getStatus().getCode()));
                res.setStatus(up?200:503);res.setContentType("application/json");res.getWriter().write("{\"status\":\""+(up?"UP":"DOWN")+"\",\"service\":\""+manifest.name()+"\"}");
            }
        });root.addServletMappingDecoded("/actuator/health","health");
        Runtime.getRuntime().addShutdownHook(new Thread(()->{
            try{tomcat.stop();}catch(Exception ignored){}
            for(int i=contexts.size()-1;i>=0;i--)contexts.get(i).close();
            try{tomcat.destroy();}catch(Exception ignored){}
        },"core-shutdown"));
        try {
            for(var module:manifest.modules()){
                var app=new SpringApplication(Class.forName(module.application()));
                app.setRegisterShutdownHook(false);
                app.addInitializers(context->((GenericApplicationContext)context).registerBean("coreServletWebServerFactory",ServletWebServerFactory.class,()->new SharedFactory(tomcat,port)));
                String prefix=module.name().equals("identity")?"IAM":module.name().toUpperCase(Locale.ROOT);
                List<String> options=new ArrayList<>(List.of(
                    "--spring.config.location=classpath:/modules/"+module.name()+"/application.yml",
                    "--server.servlet.context-path=/modules/"+module.name(),
                    "--spring.application.name="+manifest.name()+"."+module.name(),
                    "--spring.jmx.enabled=false",
                    "--spring.datasource.url="+required(prefix+"_DB_URL"),
                    "--spring.datasource.username="+required(prefix+"_DB_USER"),
                    "--spring.datasource.password="+required(prefix+"_DB_PASSWORD"),
                    "--spring.flyway.locations=classpath:/modules/"+module.name()+"/db/migration",
                    "--spring.flyway.enabled="+!module.name().equals("auth"),
                    "--management.endpoints.web.exposure.include=health,info"));
                contexts.add(app.run(options.toArray(String[]::new)));
            }
            var connector=new Connector("org.apache.coyote.http11.Http11NioProtocol");
            connector.setPort(port);connector.setProperty("address","127.0.0.1");
            tomcat.getService().addConnector(connector);
            System.out.println("CORE READY: "+manifest.name()+" on "+port+" ("+contexts.size()+" modules)");
            tomcat.getServer().await();
        }catch(Throwable e){for(var c:contexts)c.close();try{tomcat.stop();tomcat.destroy();}catch(Exception ignored){}throw e;}
    }
    static String required(String key){String value=System.getenv(key);if(value==null||value.isBlank())throw new IllegalStateException("Missing "+key);return value;}
    static final class SharedFactory extends TomcatServletWebServerFactory {
        private final Tomcat tomcat;private final int port;
        SharedFactory(Tomcat tomcat,int port){this.tomcat=tomcat;this.port=port;}
        @Override public WebServer getWebServer(ServletContextInitializer... initializers){
            var host=(StandardHost)tomcat.getHost();
            host.setStartChildren(false);
            try{prepareContext(host,initializers);}finally{host.setStartChildren(true);}
            try{if(!tomcat.getServer().getState().isAvailable())tomcat.start();else host.findChild(getContextPath()).start();}catch(Exception e){throw new IllegalStateException("Module HTTP context failed",e);}
            return new WebServer(){public void start(){}public void stop(){}public int getPort(){return port;}};
        }
    }
}
