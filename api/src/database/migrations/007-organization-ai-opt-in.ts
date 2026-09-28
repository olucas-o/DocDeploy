import type { MigrationInterface, QueryRunner } from "typeorm";

export class OrganizationAiOptIn007 implements MigrationInterface {
  name = "OrganizationAiOptIn007";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("GRANT UPDATE (ai_opt_in, updated_at) ON public.organizations TO docdeploy_app");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("REVOKE UPDATE (ai_opt_in, updated_at) ON public.organizations FROM docdeploy_app");
  }
}
