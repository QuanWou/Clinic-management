package com.clinic.v2.billing.security;
import jakarta.servlet.*;import jakarta.servlet.http.*;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.List;
@Component public class ChargeAuthenticationFilter extends OncePerRequestFilter{
 private final ChargePeerVerifier verifier;public ChargeAuthenticationFilter(ChargePeerVerifier verifier){this.verifier=verifier;}
 @Override protected boolean shouldNotFilter(HttpServletRequest req){return !req.getRequestURI().startsWith("/api/v2/internal/");}
 @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain)throws ServletException,IOException{
  var peer=verifier.verify(req.getHeader("Authorization"));if(peer==null){res.setStatus(401);res.setContentType(MediaType.APPLICATION_JSON_VALUE);res.getWriter().write("{\"error\":{\"code\":\"UNAUTHENTICATED_WORKLOAD\",\"message\":\"Trusted charge source workload required\"}}");return;}
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(peer,null,List.of(new SimpleGrantedAuthority("SCOPE_billing.charge.consume"))));try{chain.doFilter(req,res);}finally{SecurityContextHolder.clearContext();}
 }
}
