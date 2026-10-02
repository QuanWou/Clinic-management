// Disposable legacy-current-user boundary. V2 Identity/IAM itself runs as a real service.
import com.sun.net.httpserver.HttpServer;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
public class SyntheticLegacyIdentityFixture {
 static String base64(String value){return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));}
 static String token(String user,String role,String secret)throws Exception{long now=Instant.now().getEpochSecond();String input=base64("{\"alg\":\"HS256\",\"typ\":\"JWT\"}")+"."+base64("{\"sub\":\""+user+"\",\"token_type\":\"access\",\"roles\":[\""+role+"\"],\"iat\":"+now+",\"exp\":"+(now+3600)+"}");Mac mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));return input+"."+Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(input.getBytes(StandardCharsets.UTF_8)));}
 public static void main(String[] args)throws Exception{
  Map<String,String> tokens=new HashMap<>(),users=new HashMap<>(),roles=new HashMap<>();String[] names={"owner","reception","doctor","stranger"};
  for(int i=0;i<names.length;i++){String role=i==2?"ROLE_DOCTOR":"ROLE_USER",id=UUID.fromString(args[i+2]).toString(),t=token(id,role,args[1]);tokens.put(names[i],t);users.put("Bearer "+t,id);roles.put("Bearer "+t,role);}
  var server=HttpServer.create(new InetSocketAddress("127.0.0.1",Integer.parseInt(args[0])),0);
  server.createContext("/",exchange->{String path=exchange.getRequestURI().getPath(),body;int status;
   if("GET".equals(exchange.getRequestMethod())&&path.startsWith("/fixture/token/")&&tokens.containsKey(path.substring(15))){body="{\"accessToken\":\""+tokens.get(path.substring(15))+"\"}";status=200;}
   else if("GET".equals(exchange.getRequestMethod())&&path.equals("/api/users/me")&&users.containsKey(exchange.getRequestHeaders().getFirst("Authorization"))){String bearer=exchange.getRequestHeaders().getFirst("Authorization");body="{\"success\":true,\"data\":{\"id\":\""+users.get(bearer)+"\",\"status\":\"ACTIVE\",\"roles\":[\""+roles.get(bearer)+"\"]}}";status=200;}
   else{body="{}";status=401;}byte[] bytes=body.getBytes(StandardCharsets.UTF_8);exchange.getResponseHeaders().set("Content-Type","application/json");exchange.sendResponseHeaders(status,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();
  });server.start();
 }
}
