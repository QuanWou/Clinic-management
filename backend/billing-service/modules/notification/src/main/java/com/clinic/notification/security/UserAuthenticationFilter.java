package com.clinic.notification.security;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
@Component
public class UserAuthenticationFilter extends OncePerRequestFilter{
 private final IdentityClient identity;
 public UserAuthenticationFilter(IdentityClient identity){this.identity=identity;}
 @Override protected boolean shouldNotFilter(HttpServletRequest req){
  String p=req.getRequestURI().substring(req.getContextPath().length());return p.startsWith("/api/internal/")||p.startsWith("/actuator/");
 }
 @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain)throws ServletException,IOException{
  String bearer=req.getHeader("Authorization");Actor actor=identity.current(bearer);
  if(actor==null){res.setStatus(401);res.setContentType(MediaType.APPLICATION_JSON_VALUE);res.getWriter().write("{\"error\":{\"code\":\"UNAUTHENTICATED\",\"message\":\"Active session required\"}}");return;}
  var auth=new UsernamePasswordAuthenticationToken(actor,null,java.util.List.of());
  SecurityContextHolder.getContext().setAuthentication(auth);try{chain.doFilter(req,res);}finally{SecurityContextHolder.clearContext();}
 }
}

