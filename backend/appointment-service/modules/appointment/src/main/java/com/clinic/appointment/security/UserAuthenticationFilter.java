package com.clinic.appointment.security;
import jakarta.servlet.*;import jakarta.servlet.http.*;
import org.springframework.http.MediaType;import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;import org.springframework.stereotype.Component;import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
@Component
public class UserAuthenticationFilter extends OncePerRequestFilter{
 private final IdentityClient identity;public UserAuthenticationFilter(IdentityClient identity){this.identity=identity;}
 @Override protected boolean shouldNotFilter(HttpServletRequest req){String p=req.getRequestURI().substring(req.getContextPath().length());return p.startsWith("/actuator/")||p.startsWith("/api/public/")||p.startsWith("/api/internal/");}
 @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain)throws ServletException,IOException{
  Actor a=identity.current(req.getHeader("Authorization"));if(a==null){res.setStatus(401);res.setContentType(MediaType.APPLICATION_JSON_VALUE);res.getWriter().write("{\"error\":{\"code\":\"UNAUTHENTICATED\",\"message\":\"Active session required\"}}");return;}
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(a,null,java.util.List.of()));
  try{chain.doFilter(req,res);}finally{SecurityContextHolder.clearContext();}
 }
}
