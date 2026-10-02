import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
/** Test-only Identity contract fixture, used exclusively on loopback by verify-s1-projection-flow.ps1. */
public class SyntheticIdentityFixture {
 public static void main(String[] args)throws Exception{
  int port=Integer.parseInt(args[0]);String user=UUID.fromString(args[1]).toString(),stranger=UUID.randomUUID().toString();
  var server=HttpServer.create(new InetSocketAddress("127.0.0.1",port),0);
  server.createContext("/api/v2/me/current",x->{
   String token=x.getRequestHeaders().getFirst("Authorization");
   boolean owner="Bearer synthetic-booking-session".equals(token),other="Bearer synthetic-stranger-session".equals(token);
   if(!x.getRequestURI().getPath().equals("/api/v2/me/current")||(!owner&&!other)){x.sendResponseHeaders(401,-1);x.close();return;}
   byte[] body=("{\"userId\":\""+(owner?user:stranger)+"\",\"legacyRoles\":[\"ROLE_PATIENT\"],\"platformOperator\":false}").getBytes(StandardCharsets.UTF_8);
   x.getResponseHeaders().add("Content-Type","application/json");x.sendResponseHeaders(200,body.length);x.getResponseBody().write(body);x.close();
  });server.start();
 }
}

