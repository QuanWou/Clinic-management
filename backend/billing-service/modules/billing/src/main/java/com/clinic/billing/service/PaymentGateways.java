package com.clinic.billing.service;

import com.clinic.billing.api.ApiProblem;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;
import static com.clinic.billing.service.PaymentConfiguration.*;

/** Ports Lunar's checkout protocol; prices and ownership remain Billing-owned. */
@Component
public class PaymentGateways {
 private final Settings config;private final ObjectMapper json;private final RestClient payos;
 public PaymentGateways(Settings config,ObjectMapper json){
  this.config=config;this.json=json;var factory=new SimpleClientHttpRequestFactory();factory.setConnectTimeout(Duration.ofSeconds(3));factory.setReadTimeout(Duration.ofSeconds(8));
  payos=RestClient.builder().baseUrl(config.payos().baseUrl()).requestFactory(factory).build();
 }
 public record Method(String code,String name,boolean available,String message){}
 public record Link(String checkoutUrl,String qrCode,String paymentLinkId){}
 public record Confirmation(String orderCode,long amountVnd,String currency,String reference,String paymentLinkId,boolean paid){}
 public record BankDetails(String bankName,String accountNumber,String accountName,String content,long amountVnd,String qrUrl){}
 private static boolean filled(String... values){return Arrays.stream(values).allMatch(v->v!=null&&!v.isBlank());}
 public boolean enabled(UUID clinic){return config.enabled()&&clinic.equals(config.clinicId())&&filled(config.publicUrl());}
 public List<Method> methods(UUID clinic){
  boolean enabled=enabled(clinic);var p=config.payos();var v=config.vnpay();var b=config.bank();
  return List.of(new Method("PAYOS","payOS · QR ngân hàng",enabled&&filled(p.clientId(),p.apiKey(),p.checksumKey()),"Quét QR; phòng khám cập nhật khi ngân hàng xác nhận."),
   new Method("VNPAY","VNPAY · Thẻ và ngân hàng",enabled&&filled(v.tmnCode(),v.hashSecret()),v.url().contains("sandbox")?"Môi trường thử nghiệm VNPAY; không dùng thẻ thật.":"Thanh toán trên trang VNPAY."),
   new Method("BANK_TRANSFER","Chuyển khoản QR",enabled&&filled(b.bankCode(),b.bankName(),b.accountNumber(),b.accountName()),"Lễ tân đối chiếu tiền vào trước khi xác nhận."),
   new Method("ONSITE","Thanh toán tại phòng khám",true,"Trả tiền mặt, chuyển khoản hoặc thẻ tại quầy."));
 }
 public void require(UUID clinic,String provider){if(methods(clinic).stream().noneMatch(m->m.code().equals(provider)&&m.available()))throw ApiProblem.dependency("Phương thức này chưa được cấu hình cho phòng khám. Bạn có thể thanh toán tại quầy.");}
 public String returnUrl(UUID clinic,UUID branch,UUID intent){return config.publicUrl().replaceAll("/$","")+"/public/account?tab=history&payment="+intent+"&clinicId="+clinic+"&branchId="+branch;}
 public Link create(UUID clinic,UUID branch,UUID intent,String provider,String code,long amount,Instant expiry,String ip){
  require(clinic,provider);String back=returnUrl(clinic,branch,intent);
  if(provider.equals("VNPAY")){
   var data=new TreeMap<String,String>();var format=DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(ZoneId.of("Asia/Ho_Chi_Minh"));
   data.put("vnp_Version","2.1.0");data.put("vnp_Command","pay");data.put("vnp_TmnCode",config.vnpay().tmnCode());data.put("vnp_Amount",Long.toString(Math.multiplyExact(amount,100)));
   data.put("vnp_CurrCode","VND");data.put("vnp_TxnRef",code);data.put("vnp_OrderInfo","Thanh toan phieu thu "+code);data.put("vnp_OrderType","other");data.put("vnp_Locale","vn");data.put("vnp_ReturnUrl",back);data.put("vnp_IpAddr",ip);data.put("vnp_CreateDate",format.format(Instant.now()));data.put("vnp_ExpireDate",format.format(expiry));
   String query=query(data);return new Link(config.vnpay().url()+"?"+query+"&vnp_SecureHash="+hmac("HmacSHA512",config.vnpay().hashSecret(),query),null,null);
  }
  try{
   String description="PK"+code;
   var signed=new TreeMap<String,String>();signed.put("amount",Long.toString(amount));signed.put("cancelUrl",back);signed.put("description",description);signed.put("orderCode",code);signed.put("returnUrl",back);
   var body=new LinkedHashMap<String,Object>();body.put("orderCode",Long.parseLong(code));body.put("amount",amount);body.put("description",description);body.put("returnUrl",back);body.put("cancelUrl",back);body.put("expiredAt",expiry.getEpochSecond());body.put("signature",hmac("HmacSHA256",config.payos().checksumKey(),plain(signed)));
   var response=payos.post().uri("/v2/payment-requests").header("x-client-id",config.payos().clientId()).header("x-api-key",config.payos().apiKey()).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(JsonNode.class);
   // A lost create response must recover the same order code, not create another link.
   if(response==null||!"00".equals(response.path("code").asText()))return recoverLink(code,amount);
   var data=verifiedData(response);validateLink(data,code,amount);
   return link(data);
  }catch(ApiProblem e){throw e;}catch(Exception e){return recoverLink(code,amount);}
 }
 private Link recoverLink(String code,long amount){var data=payment(code);validateLink(data,code,amount);return link(data);}
 private static Link link(JsonNode data){String url=data.path("checkoutUrl").asText();if(url.isBlank()&&data.path("id").isTextual())url="https://pay.payos.vn/web/"+data.path("id").asText();safeCheckout(url);return new Link(url,data.path("qrCode").asText(null),data.path("paymentLinkId").asText(data.path("id").asText(null)));}
 private static void validateLink(JsonNode data,String code,long amount){if(!code.equals(data.path("orderCode").asText())||data.path("amount").asLong(-1)!=amount)throw ApiProblem.dependency("Chưa đối chiếu được số tiền từ cổng thanh toán. Hãy kiểm tra lại giao dịch hiện tại.");}
 private static void safeCheckout(String url){try{var uri=URI.create(url);if(!"https".equals(uri.getScheme())||!Set.of("pay.payos.vn","payos.vn").contains(uri.getHost()))throw new IllegalArgumentException();}catch(Exception e){throw ApiProblem.dependency("Cổng thanh toán trả về đường dẫn chưa hợp lệ.");}}
 public JsonNode payment(String code){try{var response=payos.get().uri("/v2/payment-requests/{code}",code).header("x-client-id",config.payos().clientId()).header("x-api-key",config.payos().apiKey()).retrieve().body(JsonNode.class);return verifiedData(response);}catch(ApiProblem e){throw e;}catch(Exception e){throw ApiProblem.dependency("Chưa kết nối được cổng thanh toán. Giữ giao dịch hiện tại và kiểm tra lại.");}}
 public JsonNode cancel(String code){try{return verifiedData(payos.post().uri("/v2/payment-requests/{code}/cancel",code).header("x-client-id",config.payos().clientId()).header("x-api-key",config.payos().apiKey()).contentType(MediaType.APPLICATION_JSON).body(Map.of("cancellationReason","Khach chon phuong thuc khac")).retrieve().body(JsonNode.class));}catch(ApiProblem e){throw e;}catch(Exception e){return payment(code);}}
 private JsonNode verifiedData(JsonNode response){if(response==null||!"00".equals(response.path("code").asText())||!response.path("data").isObject()||!validPayos(response.path("data"),response.path("signature").asText()))throw ApiProblem.dependency("Chưa xác thực được phản hồi của cổng thanh toán.");return response.path("data");}
 public Confirmation webhook(JsonNode body){var data=body.path("data");if(!data.isObject()||!validPayos(data,body.path("signature").asText()))throw ApiProblem.invalid("Chữ ký giao dịch không hợp lệ.");return new Confirmation(data.path("orderCode").asText(),whole(data.path("amount")),data.path("currency").asText(),data.path("reference").asText(),data.path("paymentLinkId").asText(),"00".equals(data.path("code").asText()));}
 public boolean validVnpay(Map<String,String> data){var signed=new TreeMap<String,String>();data.forEach((k,v)->{if(k.startsWith("vnp_")&&!Set.of("vnp_SecureHash","vnp_SecureHashType").contains(k))signed.put(k,v);});return filled(config.vnpay().hashSecret())&&equal(hmac("HmacSHA512",config.vnpay().hashSecret(),query(signed)),data.get("vnp_SecureHash"))&&Objects.equals(config.vnpay().tmnCode(),data.get("vnp_TmnCode"));}
 public Confirmation vnpay(Map<String,String> data){if(!validVnpay(data))throw ApiProblem.invalid("Chữ ký giao dịch không hợp lệ.");try{long minor=Long.parseLong(data.get("vnp_Amount"));if(minor<=0||minor%100!=0)throw new IllegalArgumentException();return new Confirmation(data.get("vnp_TxnRef"),minor/100,"VND",data.get("vnp_TransactionNo"),null,"00".equals(data.get("vnp_ResponseCode"))&&"00".equals(data.get("vnp_TransactionStatus")));}catch(Exception e){throw ApiProblem.invalid("Số tiền giao dịch không hợp lệ.");}}
 public boolean validPayos(JsonNode data,String signature){if(!filled(config.payos().checksumKey()))return false;var values=new TreeMap<String,String>();data.fields().forEachRemaining(e->values.put(e.getKey(),payosValue(e.getValue())));return equal(hmac("HmacSHA256",config.payos().checksumKey(),plain(values)),signature);}
 private String payosValue(JsonNode value){if(value.isNull()||value.isTextual()&&Set.of("null","undefined").contains(value.asText()))return "";if(value.isContainerNode()){try{return json.writeValueAsString(sort(value));}catch(Exception e){throw ApiProblem.invalid("Dữ liệu chữ ký không hợp lệ.");}}return value.asText();}
 private JsonNode sort(JsonNode node){if(node.isArray()){var result=json.createArrayNode();node.forEach(n->result.add(sort(n)));return result;}if(node.isObject()){var result=json.createObjectNode();var keys=new TreeSet<String>();node.fieldNames().forEachRemaining(keys::add);keys.forEach(k->result.set(k,sort(node.get(k))));return result;}return node;}
 private static long whole(JsonNode node){if(!node.isIntegralNumber()||!node.canConvertToLong()||node.asLong()<=0)throw ApiProblem.invalid("Số tiền giao dịch không hợp lệ.");return node.asLong();}
 public BankDetails bank(UUID clinic,UUID bill,long amount){require(clinic,"BANK_TRANSFER");var b=config.bank();String content="PK"+bill.toString().replace("-","").substring(0,20).toUpperCase(Locale.ROOT);String url="https://img.vietqr.io/image/"+encode(b.bankCode())+"-"+encode(b.accountNumber())+"-compact2.png?amount="+amount+"&addInfo="+encode(content)+"&accountName="+encode(b.accountName());return new BankDetails(b.bankName(),b.accountNumber(),b.accountName(),content,amount,url);}
 public static String hmac(String algorithm,String secret,String value){try{var mac=Mac.getInstance(algorithm);mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),algorithm));return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException("Cannot sign payment request",e);}}
 private static boolean equal(String expected,String actual){return actual!=null&&MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII),actual.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.US_ASCII));}
 public static String query(Map<String,String> data){return new TreeMap<>(data).entrySet().stream().map(e->encode(e.getKey())+"="+encode(e.getValue())).collect(Collectors.joining("&"));}
 private static String plain(Map<String,String> data){return new TreeMap<>(data).entrySet().stream().map(e->e.getKey()+"="+e.getValue()).collect(Collectors.joining("&"));}
 private static String encode(String value){return URLEncoder.encode(value,StandardCharsets.UTF_8);}
}
