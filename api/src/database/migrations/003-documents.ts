import type { MigrationInterface, QueryRunner } from "typeorm";

export class Documents003 implements MigrationInterface {
  name = "Documents003";
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE documents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), name varchar(255) NOT NULL,
        type varchar(32) NOT NULL CHECK (type IN ('contract','invoice','certificate','report','registration')),
        origin varchar(255) NOT NULL, responsible_id uuid NOT NULL REFERENCES users(id), status varchar(32) NOT NULL DEFAULT 'UPLOADING',
        received_at timestamptz NOT NULL, current_version_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE document_versions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), document_id uuid NOT NULL REFERENCES documents(id),
        number integer NOT NULL CHECK (number > 0), sha256 varchar(64), size bigint CHECK (size IS NULL OR (size > 0 AND size <= 26214400)),
        detected_type varchar(64), object_key varchar(1024) NOT NULL, object_version_id varchar(255), state varchar(40) NOT NULL DEFAULT 'UPLOADING',
        created_by uuid NOT NULL REFERENCES users(id), replacement_reason text, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_document_version_number UNIQUE (document_id, number), CONSTRAINT uq_document_version_hash UNIQUE (document_id, sha256),
        CONSTRAINT uq_document_version_identity UNIQUE (document_id, id)
      );
      ALTER TABLE documents ADD CONSTRAINT fk_current_version_same_document
        FOREIGN KEY (id, current_version_id) REFERENCES document_versions(document_id, id) DEFERRABLE INITIALLY DEFERRED;
      CREATE TABLE stored_artifacts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
        document_version_id uuid NOT NULL REFERENCES document_versions(id), zone varchar(16) NOT NULL CHECK (zone IN ('quarantine','clean','derived')),
        object_key varchar(1024) NOT NULL, sha256 varchar(64) NOT NULL, size bigint NOT NULL CHECK (size > 0 AND size <= 26214400),
        content_type varchar(64) NOT NULL, origin varchar(32) NOT NULL, retention_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_stored_artifact_key UNIQUE (organization_id, object_key)
      );
      CREATE INDEX ix_documents_search ON documents (organization_id, type, status, responsible_id, received_at);
      CREATE INDEX ix_document_versions_organization_document ON document_versions (organization_id, document_id);
      CREATE INDEX ix_artifacts_document_version ON stored_artifacts (organization_id, document_version_id);
      GRANT SELECT, INSERT, UPDATE ON documents, document_versions, stored_artifacts TO docdeploy_app;
    `);
    for (const table of ["documents", "document_versions", "stored_artifacts"]) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`CREATE POLICY ${table}_tenant_policy ON ${table} USING (organization_id = current_setting('app.organization_id', true)::uuid) WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid)`);
    }
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS stored_artifacts, document_versions, documents CASCADE");
  }
}
