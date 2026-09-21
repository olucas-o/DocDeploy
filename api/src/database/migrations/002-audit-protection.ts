import type { MigrationInterface, QueryRunner } from "typeorm";

export class AuditProtection002 implements MigrationInterface {
  name = "AuditProtection002";
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM docdeploy_app");
    await queryRunner.query("GRANT SELECT, INSERT ON audit_events TO docdeploy_app");
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("REVOKE ALL ON audit_events FROM docdeploy_app");
  }
}
