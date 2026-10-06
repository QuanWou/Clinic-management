package com.clinic.runtime;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.apache.catalina.startup.Tomcat;
import org.apache.catalina.connector.Connector;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.web.servlet.server.ServletWebServerFactory;
import org.springframework.context.*;
import org.springframework.context.annotation.*;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.core.env.Environment;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.file.Path;
import java.net.URI;
import java.net.http.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
class SharedServerTest {
 @TempDir Path base;
 @Configuration(proxyBeanMethods=false) @EnableAutoConfiguration
 static class ModuleConfig {@Bean Probe probe(Environment env){return new Probe(env.getProperty("probe.name"));}}
 @RestController static class Probe {
  final String name;Probe(String name){this.name=name;}
  @GetMapping("/api/probe") String read(HttpServletRequest request){return name+":"+request.getContextPath();}
 }
 @Test void hostsTwoIsolatedModulesOnOneListener()throws Exception{
  var tomcat=new Tomcat();tomcat.setBaseDir(base.toString());var contexts=new ArrayList<ConfigurableApplicationContext>();
  try{
   for(String name:List.of("first","second")){
    var app=new SpringApplication(ModuleConfig.class);app.setRegisterShutdownHook(false);
    app.addInitializers(ctx->((GenericApplicationContext)ctx).registerBean("coreFactory",ServletWebServerFactory.class,()->new CoreApplication.SharedFactory(tomcat,0)));
    contexts.add(app.run("--server.servlet.context-path=/modules/"+name,"--probe.name="+name,"--spring.jmx.enabled=false"));
   }
   var connector=new Connector();connector.setPort(0);connector.setProperty("address","127.0.0.1");tomcat.getService().addConnector(connector);
   var http=HttpClient.newHttpClient();for(String name:List.of("first","second")){
    var response=http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+connector.getLocalPort()+"/modules/"+name+"/api/probe")).build(),HttpResponse.BodyHandlers.ofString());
    assertEquals(200,response.statusCode());assertEquals(name+":/modules/"+name,response.body());
   }
   assertEquals(1,tomcat.getService().findConnectors().length);
  }finally{tomcat.stop();for(var ctx:contexts)ctx.close();tomcat.destroy();}
 }
}
