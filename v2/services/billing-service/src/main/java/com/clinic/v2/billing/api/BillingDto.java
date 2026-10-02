package com.clinic.v2.billing.api;
import jakarta.validation.constraints.*;
import java.util.*;
import java.time.Instant;
public final class BillingDto {
 private BillingDto(){}
 public record IssueInput(@NotNull UUID encounterId,@NotBlank @Size(max=500) String reason){}
 public record PaymentInput(@Min(0) long expectedVersion,@NotNull UUID shiftId,@Min(1) @Max(9000000000000L) long amountVnd,@Pattern(regexp="CASH|BANK_TRANSFER|POS") @NotBlank String method,@Size(max=200) String externalRef,@NotBlank @Size(max=500) String reason){}
 public record AdjustmentInput(@Min(0) long expectedVersion,@Min(1) @Max(9000000000000L) long amountVnd,@NotBlank @Size(max=500) String reason){}
 public record ShiftInput(@NotBlank @Size(max=500) String reason){}
 public record ShiftSubmit(@Min(0) long expectedVersion,@Min(0) @Max(9000000000000L) long declaredCashVnd,@Min(0) @Max(9000000000000L) long declaredBankVnd,@Min(0) @Max(9000000000000L) long declaredPosVnd,@NotBlank @Size(max=500) String reason){}
 public record ApproveInput(@Min(0) long expectedVersion,@NotBlank @Size(max=500) String reason){}
 public record Line(UUID chargeId,String sourceType,UUID sourceId,UUID offeringId,String name,long amountVnd){}
 public record Bill(UUID id,UUID encounterId,UUID patientId,String currency,long subtotalVnd,long adjustmentVnd,long paidVnd,long remainingVnd,String status,long version,List<Line> lines){}
 public record Receipt(UUID id,UUID billId,UUID shiftId,UUID collectorUserId,long amountVnd,String currency,String method,String externalRef,String receiptCode,Instant createdAt,String label){}
 public record Shift(UUID id,UUID collectorUserId,String state,long version,Long expectedCashVnd,Long expectedBankVnd,Long expectedPosVnd,Long declaredCashVnd,Long declaredBankVnd,Long declaredPosVnd,Long varianceVnd,UUID approvedBy){}
}
