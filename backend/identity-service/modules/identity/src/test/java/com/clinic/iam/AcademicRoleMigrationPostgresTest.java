package com.clinic.iam;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.*;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfSystemProperty(named="role.it.enabled", matches="true")
class AcademicRoleMigrationPostgresTest {
    @Test void preservesHistoryMergesActiveGrantsAndNeverActivatesAnInviteOrRevokedRole() throws Exception {
        String url = System.getenv("ROLE_TEST_JDBC_URL");
        if (url == null || !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/clinic_v2_role_migration_[a-z0-9_]+"))
            throw new IllegalStateException("Role migration test requires a fresh disposable database");
        String user = System.getenv("ROLE_TEST_DB_USER"), password = System.getenv("ROLE_TEST_DB_PASSWORD");
        Flyway.configure().dataSource(url,user,password).target("1").load().migrate();
        UUID clinic = UUID.randomUUID(), admin = UUID.randomUUID(), staff = UUID.randomUUID(), nurse = UUID.randomUUID(), waiting = UUID.randomUUID();
        UUID ownerMembership = UUID.randomUUID(), reception = UUID.randomUUID(), cashier = UUID.randomUUID();
        UUID invited = UUID.randomUUID(), retired = UUID.randomUUID(), nursing = UUID.randomUUID(), waitingStaff = UUID.randomUUID();
        UUID branchA = UUID.randomUUID(), branchB = UUID.randomUUID(), ignoredBranch = UUID.randomUUID();
        try (Connection connection = DriverManager.getConnection(url,user,password)) {
            add(connection,ownerMembership,admin,clinic,"CLINIC_OWNER","ACTIVE",true);
            add(connection,UUID.randomUUID(),admin,clinic,"CLINIC_MANAGER","ACTIVE",false);
            add(connection,reception,staff,clinic,"RECEPTIONIST","ACTIVE",false);
            add(connection,cashier,staff,clinic,"CASHIER","ACTIVE",false);
            add(connection,retired,staff,clinic,"CASHIER","REVOKED",true);
            add(connection,nursing,nurse,clinic,"NURSE","ACTIVE",true);
            add(connection,waitingStaff,waiting,clinic,"RECEPTIONIST","ACTIVE",false);
            add(connection,invited,waiting,clinic,"CASHIER","INVITED",true);
            grant(connection,reception,staff,clinic,branchA);
            grant(connection,cashier,staff,clinic,branchB);
            grant(connection,waitingStaff,waiting,clinic,branchA);
            grant(connection,invited,waiting,clinic,ignoredBranch);
            int originalRows = count(connection,"select count(*) from iam.memberships");
            Flyway.configure().dataSource(url,user,password).load().migrate();
            assertEquals(originalRows,count(connection,"select count(*) from iam.memberships"));
            assertEquals(0,count(connection,"select count(*) from iam.memberships where role not in ('ADMIN','STAFF','DOCTOR')"));
            assertEquals(1,count(connection,"select count(*) from iam.memberships where user_id='"+admin+"' and role='ADMIN' and status='ACTIVE' and clinic_owner"));
            assertEquals(1,count(connection,"select count(*) from iam.memberships where user_id='"+admin+"' and status='ACTIVE'"));
            assertEquals(2,count(connection,"select count(*) from iam.membership_branch_grants g join iam.memberships m on m.id=g.membership_id where m.user_id='"+staff+"' and m.status='ACTIVE' and g.active"));
            assertEquals(0,count(connection,"select count(*) from iam.memberships where user_id='"+staff+"' and status='ACTIVE' and all_branches"));
            assertEquals(1,count(connection,"select count(*) from iam.memberships where id='"+retired+"' and status='REVOKED'"));
            assertEquals(1,count(connection,"select count(*) from iam.memberships where id='"+nursing+"' and role='DOCTOR' and status='REVOKED'"));
            assertEquals(0,count(connection,"select count(*) from iam.memberships where user_id='"+waiting+"' and status='ACTIVE' and all_branches"));
            assertEquals(0,count(connection,"select count(*) from iam.membership_branch_grants g join iam.memberships m on m.id=g.membership_id where m.user_id='"+waiting+"' and m.status='ACTIVE' and g.active and branch_id='"+ignoredBranch+"'"));
            assertTrue(count(connection,"select count(*) from iam.membership_events where action='ACADEMIC_ROLE_MIGRATED'") > 0);
            assertThrows(SQLException.class,()->add(connection,UUID.randomUUID(),UUID.randomUUID(),clinic,"NURSE","ACTIVE",true));
        }
    }

    private void add(Connection c, UUID id, UUID user, UUID clinic, String role, String status, boolean all) throws SQLException {
        try (PreparedStatement q = c.prepareStatement("insert into iam.memberships(id,user_id,clinic_id,role,status,all_branches,invited_by) values(?,?,?,?,?,?,?)")) {
            q.setObject(1,id);q.setObject(2,user);q.setObject(3,clinic);q.setString(4,role);q.setString(5,status);q.setBoolean(6,all);q.setObject(7,user);q.executeUpdate();
        }
    }

    private void grant(Connection c, UUID membership, UUID user, UUID clinic, UUID branch) throws SQLException {
        try (PreparedStatement q = c.prepareStatement("insert into iam.membership_branch_grants(id,membership_id,user_id,clinic_id,branch_id,granted_by) values(?,?,?,?,?,?)")) {
            q.setObject(1,UUID.randomUUID());q.setObject(2,membership);q.setObject(3,user);q.setObject(4,clinic);q.setObject(5,branch);q.setObject(6,user);q.executeUpdate();
        }
    }

    private int count(Connection c,String sql) throws SQLException {
        try (Statement q=c.createStatement();ResultSet rows=q.executeQuery(sql)) {rows.next();return rows.getInt(1);}
    }
}
