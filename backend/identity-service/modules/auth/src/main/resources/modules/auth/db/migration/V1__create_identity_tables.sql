CREATE SCHEMA IF NOT EXISTS identity;

CREATE TABLE IF NOT EXISTS identity.users (
                                              id UUID PRIMARY KEY,
                                              email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
    );

CREATE TABLE IF NOT EXISTS identity.roles (
                                              id UUID PRIMARY KEY,
                                              code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL
    );

CREATE TABLE IF NOT EXISTS identity.user_roles (
                                                   user_id UUID NOT NULL,
                                                   role_id UUID NOT NULL,
                                                   PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES identity.users(id),
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES identity.roles(id)
    );

CREATE TABLE IF NOT EXISTS identity.refresh_tokens (
                                                       id UUID PRIMARY KEY,
                                                       user_id UUID NOT NULL,
                                                       token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES identity.users(id)
    );