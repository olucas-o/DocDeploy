import type { MigrationInterface, QueryRunner } from "typeorm";

const tenantTables = ["organization_memberships", "sessions", "audit_events", "outbox_events", "notifications", "processing_runs"];

export class BaseTenancy001 implements MigrationInterface {
  name = "BaseTenancy001";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'docdeploy_app') THEN
          CREATE ROLE docdeploy_app LOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
        END IF;
      END $$;
      CREATE TABLE organizations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(160) NOT NULL,
        status varchar(32) NOT NULL DEFAULT 'active', retention_policy jsonb NOT NULL DEFAULT '{}',
        ai_opt_in boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), normalized_email varchar(320) NOT NULL UNIQUE,
        name varchar(160) NOT NULL, status varchar(32) NOT NULL DEFAULT 'active', password_hash text,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE organization_memberships (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
        user_id uuid NOT NULL REFERENCES users(id), role varchar(32) NOT NULL, permissions text[] NOT NULL DEFAULT '{}',
        status varchar(32) NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_membership_organization_user UNIQUE (organization_id, user_id)
      );
      CREATE TABLE sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
        user_id uuid NOT NULL REFERENCES users(id), refresh_token_hash text NOT NULL, token_family uuid NOT NULL,
        expires_at timestamptz NOT NULL, revoked_at timestamptz, device_metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE audit_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), sequence bigint NOT NULL,
        previous_hash varchar(64), current_hash varchar(64) NOT NULL, actor_id uuid, actor_type varchar(16) NOT NULL,
        action varchar(96) NOT NULL, resource_type varchar(64) NOT NULL, resource_id uuid NOT NULL, version integer,
        result varchar(32) NOT NULL, reason text, correlation_id uuid NOT NULL, metadata jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT uq_audit_organization_sequence UNIQUE (organization_id, sequence)
      );
      CREATE TABLE outbox_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), event_type varchar(96) NOT NULL,
        schema_version smallint NOT NULL, payload jsonb NOT NULL, idempotency_key varchar(255) NOT NULL,
        published_at timestamptz, failure_message text, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_outbox_idempotency UNIQUE (organization_id, idempotency_key)
      );
      CREATE TABLE notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), recipient_id uuid NOT NULL,
        channel varchar(24) NOT NULL, type varchar(64) NOT NULL, state varchar(24) NOT NULL, resource_type varchar(64) NOT NULL,
        resource_id uuid NOT NULL, attempts smallint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE processing_runs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), document_version_id uuid NOT NULL,
        operation varchar(48) NOT NULL, processor_version varchar(64) NOT NULL, idempotency_key varchar(255) NOT NULL UNIQUE,
        bull_job_id varchar(255), state varchar(32) NOT NULL DEFAULT 'QUEUED', stage varchar(48), progress smallint NOT NULL DEFAULT 0,
        attempts smallint NOT NULL DEFAULT 0, correlation_id uuid NOT NULL, sanitized_error jsonb,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_processing_run_version_operation UNIQUE (organization_id, document_version_id, operation, processor_version)
      );
      ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
      CREATE POLICY organizations_tenant_policy ON organizations
        USING (id = current_setting('app.organization_id', true)::uuid)
        WITH CHECK (id = current_setting('app.organization_id', true)::uuid);
      CREATE OR REPLACE FUNCTION public.resolve_login(p_email text)
      RETURNS TABLE(user_id uuid, password_hash text, organization_id uuid, permissions text[])
      LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $function$
        SELECT u.id, u.password_hash, m.organization_id, m.permissions
        FROM public.users u
        JOIN public.organization_memberships m ON m.user_id = u.id
        WHERE u.normalized_email = lower(trim(p_email)) AND u.status = 'active' AND m.status = 'active'
      $function$;
      CREATE OR REPLACE FUNCTION public.resolve_session(p_session_id uuid)
      RETURNS TABLE(session_id uuid, user_id uuid, organization_id uuid, refresh_token_hash text, token_family uuid, expires_at timestamptz, permissions text[])
      LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $function$
        SELECT s.id, s.user_id, s.organization_id, s.refresh_token_hash, s.token_family, s.expires_at, m.permissions
        FROM public.sessions s
        JOIN public.organization_memberships m ON m.user_id = s.user_id AND m.organization_id = s.organization_id
        WHERE s.id = p_session_id AND s.revoked_at IS NULL AND m.status = 'active'
      $function$;
      REVOKE ALL ON FUNCTION public.resolve_login(text) FROM PUBLIC;
      REVOKE ALL ON FUNCTION public.resolve_session(uuid) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION public.resolve_login(text), public.resolve_session(uuid) TO docdeploy_app;
      GRANT USAGE ON SCHEMA public TO docdeploy_app;
      GRANT SELECT, INSERT, UPDATE ON organization_memberships, sessions, outbox_events, notifications, processing_runs TO docdeploy_app;
      GRANT SELECT ON organizations TO docdeploy_app;
      GRANT SELECT, INSERT ON audit_events TO docdeploy_app;
    `);
    for (const table of tenantTables) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`CREATE POLICY ${table}_tenant_policy ON ${table} USING (organization_id = current_setting('app.organization_id', true)::uuid) WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid)`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS processing_runs, notifications, outbox_events, audit_events, sessions, organization_memberships, users, organizations CASCADE");
  }
}
