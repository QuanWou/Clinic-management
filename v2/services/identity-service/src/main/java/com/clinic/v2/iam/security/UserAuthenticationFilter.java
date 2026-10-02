package com.clinic.v2.iam.security;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
@Component
public class UserAuthenticationFilter extends OncePerRequestFilter {
 private final TokenVerifier tokens; private final LegacyIdentityClient legacy; private final SessionSecurityService sessions;
 public UserAuthenticationFilter(TokenVerifier tokens,LegacyIdentityClient legacy,SessionSecurityService sessions){this.tokens=tokens;this.legacy=legacy;this.sessions=sessions;}
 @Override protected boolean shouldNotFilter(HttpServletRequest req){
  String p=req.getRequestURI(); return p.startsWith("/api/v2/internal/")||p.startsWith("/actuator/");
 }
 @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain)throws ServletException,IOException{
  SecurityContextHolder.clearContext();String bearer=req.getHeader("Authorization");Actor actor=tokens.verify(bearer);
  if(actor==null||!legacy.current(bearer,actor)||!sessions.accessAllowed(actor)){deny(res);return;}
  var auth=new UsernamePasswordAuthenticationToken(actor,null,actor.roles().stream().map(SimpleGrantedAuthority::new).toList());
  SecurityContextHolder.getContext().setAuthentication(auth);
  try{chain.doFilter(req,res);}finally{SecurityContextHolder.clearContext();}
 }
 private void deny(HttpServletResponse res)throws IOException{
  res.setStatus(401);res.setContentType(MediaType.APPLICATION_JSON_VALUE);
  res.getWriter().write("{\"error\":{\"code\":\"UNAUTHENTICATED\",\"message\":\"Active non-revoked session required\"}}");
 }
}
