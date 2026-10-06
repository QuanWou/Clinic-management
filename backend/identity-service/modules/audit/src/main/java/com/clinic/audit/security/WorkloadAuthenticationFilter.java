package com.clinic.audit.security;

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
public class WorkloadAuthenticationFilter extends OncePerRequestFilter {
    private final WorkloadTokenVerifier verifier;
    public WorkloadAuthenticationFilter(WorkloadTokenVerifier verifier){this.verifier=verifier;}

    @Override protected boolean shouldNotFilter(HttpServletRequest req){
        return req.getRequestURI().substring(req.getContextPath().length()).startsWith("/actuator/");
    }

    @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain)
        throws ServletException,IOException{
        SecurityContextHolder.clearContext();
        WorkloadPrincipal principal=verifier.verify(req.getHeader("Authorization"));
        if(principal==null){
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            res.setContentType(MediaType.APPLICATION_JSON_VALUE);
            res.getWriter().write("{\"error\":{\"code\":\"UNAUTHENTICATED_WORKLOAD\",\"message\":\"Valid workload token required\"}}");
            return;
        }
        var authorities=principal.scopes().stream().map(s->new SimpleGrantedAuthority("SCOPE_"+s)).toList();
        var auth=new UsernamePasswordAuthenticationToken(principal,null,authorities);
        SecurityContextHolder.getContext().setAuthentication(auth);
        try{chain.doFilter(req,res);}finally{SecurityContextHolder.clearContext();}
    }
}
