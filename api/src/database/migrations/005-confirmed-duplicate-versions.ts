import type { MigrationInterface, QueryRunner } from "typeorm";

export class ConfirmedDuplicateVersions005 implements MigrationInterface {
  name = "ConfirmedDuplicateVersions005";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE document_versions DROP CONSTRAINT IF EXISTS uq_document_version_hash");
    await queryRunner.query("CREATE INDEX IF NOT EXISTS ix_document_versions_document_hash ON document_versions (document_id, sha256)");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const duplicates = await queryRunner.query("SELECT 1 FROM document_versions GROUP BY document_id, sha256 HAVING count(*) > 1 LIMIT 1");
    if (duplicates.length > 0) throw new Error("Cannot restore document hash uniqueness while confirmed duplicate versions exist");
    await queryRunner.query("DROP INDEX IF EXISTS ix_document_versions_document_hash");
    await queryRunner.query("ALTER TABLE document_versions ADD CONSTRAINT uq_document_version_hash UNIQUE (document_id, sha256)");
  }
}
