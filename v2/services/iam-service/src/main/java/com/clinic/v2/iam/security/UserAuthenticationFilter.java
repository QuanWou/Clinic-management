package com.clinic.v2.iam.security;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

@Component
public class UserAuthenticationFilter extends OncePerRequestFilter {
    private final UserTokenVerifier tokens;
    private final LegacyIdentityClient identity;
    public UserAuthenticationFilter(UserTokenVerifier tokens,LegacyIdentityClient identity){this.tokens=tokens;this.identity=identity;}
    @Override protected boolean shouldNotFilter(HttpServletRequest req){
        String p=req.getRequestURI();
        return p.startsWith("/api/v2/internal/") || p.startsWith("/actuator/");
    }
    @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain)
        throws ServletException,IOException {
        SecurityContextHolder.clearContext();
        String bearer=req.getHeader("Authorization");
        Actor actor=tokens.verify(bearer);
        if(actor==null || !identity.current(bearer,actor)){
            res.setStatus(401);res.setContentType(MediaType.APPLICATION_JSON_VALUE);
            res.getWriter().write("{\"error\":{\"code\":\"UNAUTHENTICATED\",\"message\":\"Active access session required\"}}");
            return;
        }
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(actor,null,java.util.List.of()));
        try{chain.doFilter(req,res);}finally{SecurityContextHolder.clearContext();}
    }
}
