package com.clinic.v2.catalog.security;
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
public class ApiAuthenticationFilter extends OncePerRequestFilter {
    private final IdentityClient identity;
    public ApiAuthenticationFilter(IdentityClient identity){this.identity=identity;}
    @Override protected boolean shouldNotFilter(HttpServletRequest req){String p=req.getRequestURI();return p.startsWith("/actuator/")||p.startsWith("/api/v2/public/");}
    @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain)
            throws ServletException,IOException{
        SecurityContextHolder.clearContext();
        Actor actor=identity.current(req.getHeader("Authorization"));
        if(actor==null){
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            res.setContentType(MediaType.APPLICATION_JSON_VALUE);
            res.getWriter().write("{\"error\":{\"code\":\"UNAUTHENTICATED\",\"message\":\"Active V2 session required\"}}");
            return;
        }
        var auth=new UsernamePasswordAuthenticationToken(actor,null,
            actor.legacyRoles().stream().map(SimpleGrantedAuthority::new).toList());
        SecurityContextHolder.getContext().setAuthentication(auth);
        try{chain.doFilter(req,res);}finally{SecurityContextHolder.clearContext();}
    }
}
