package com.clinic.search.domain;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.*;

@Entity
@Table(name="projection_receipts",schema="search_v2")
@IdClass(ProjectionReceipt.Key.class)
public class ProjectionReceipt {
  @Id @Column(length=80) public String source;
  @Id @Column(name="aggregate_type",length=60) public String aggregateType;
  @Id @Column(name="aggregate_id") public UUID aggregateId;
  @Column(name="source_version",nullable=false) public long sourceVersion;
  @Column(name="event_id") public UUID eventId;
  @Column(name="indexed_at",nullable=false) public Instant indexedAt;
  @PrePersist @PreUpdate void touch(){indexedAt=Instant.now();}
  public static class Key implements Serializable{
    public String source; public String aggregateType; public UUID aggregateId;
    public Key(){}
    public Key(String source,String aggregateType,UUID aggregateId){this.source=source;this.aggregateType=aggregateType;this.aggregateId=aggregateId;}
    @Override public boolean equals(Object o){return o instanceof Key k&&Objects.equals(source,k.source)&&Objects.equals(aggregateType,k.aggregateType)&&Objects.equals(aggregateId,k.aggregateId);}
    @Override public int hashCode(){return Objects.hash(source,aggregateType,aggregateId);}
  }
}
