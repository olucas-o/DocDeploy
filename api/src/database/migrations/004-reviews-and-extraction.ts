import type { MigrationInterface, QueryRunner } from "typeorm";

export class ReviewsAndExtraction004 implements MigrationInterface {
  name = "ReviewsAndExtraction004";
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE processing_runs ADD CONSTRAINT fk_processing_run_version FOREIGN KEY (document_version_id) REFERENCES document_versions(id);
      CREATE TABLE extracted_fields (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), document_version_id uuid NOT NULL REFERENCES document_versions(id),
        field_key varchar(64) NOT NULL, typed_value jsonb, original_value jsonb, previous_values jsonb NOT NULL DEFAULT '[]',
        source varchar(24) NOT NULL, page integer, excerpt text, confidence real CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
        review_state varchar(32) NOT NULL DEFAULT 'UNREVIEWED', reviewer_id uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_extracted_field_version_key UNIQUE (document_version_id, field_key)
      );
      CREATE TABLE reviews (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), document_id uuid NOT NULL REFERENCES documents(id),
        document_version_id uuid NOT NULL UNIQUE REFERENCES document_versions(id), state varchar(32) NOT NULL DEFAULT 'PENDING', responsible_id uuid REFERENCES users(id),
        decision varchar(32), justification text, decided_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT review_decision_reason CHECK (decision NOT IN ('REJECTED','RETURNED_FOR_COMPLEMENT') OR length(trim(justification)) > 0)
      );
      CREATE TABLE review_tasks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), review_id uuid NOT NULL REFERENCES reviews(id),
        title varchar(255) NOT NULL, responsible_id uuid NOT NULL REFERENCES users(id), due_at timestamptz, state varchar(24) NOT NULL DEFAULT 'OPEN',
        resolution text, resolved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT review_task_resolution CHECK (state NOT IN ('RESOLVED','CANCELLED') OR (length(trim(resolution)) > 0 AND resolved_at IS NOT NULL))
      );
      CREATE TABLE review_comments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), review_id uuid NOT NULL REFERENCES reviews(id),
        review_task_id uuid REFERENCES review_tasks(id), author_id uuid NOT NULL REFERENCES users(id), message text NOT NULL,
        extracted_field_id uuid REFERENCES extracted_fields(id), created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX ix_extracted_fields_version ON extracted_fields (organization_id, document_version_id);
      CREATE INDEX ix_reviews_document_version ON reviews (organization_id, document_id, document_version_id);
      CREATE INDEX ix_review_tasks_review_state ON review_tasks (organization_id, review_id, state);
      CREATE INDEX ix_review_comments_review ON review_comments (organization_id, review_id, created_at);
      GRANT SELECT, INSERT, UPDATE ON extracted_fields, reviews, review_tasks, review_comments TO docdeploy_app;
    `);
    for (const table of ["extracted_fields", "reviews", "review_tasks", "review_comments"]) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`CREATE POLICY ${table}_tenant_policy ON ${table} USING (organization_id = current_setting('app.organization_id', true)::uuid) WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid)`);
    }
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE processing_runs DROP CONSTRAINT IF EXISTS fk_processing_run_version; DROP TABLE IF EXISTS review_comments, review_tasks, reviews, extracted_fields CASCADE");
  }
}
