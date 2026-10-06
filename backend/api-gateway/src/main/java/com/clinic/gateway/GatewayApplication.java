package com.clinic.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.beans.factory.annotation.Value;
import java.io.IOException;

@SpringBootApplication
public class GatewayApplication {
 public static void main(String[] args){SpringApplication.run(GatewayApplication.class,args);}
 @Bean ServletRegistrationBean<GatewayServlet> gateway(@Value("${gateway.routes}") String routes)throws IOException{
  var registration=new ServletRegistrationBean<>(new GatewayServlet(routes),"/s1/*");
  registration.setLoadOnStartup(1);return registration;
 }
}
