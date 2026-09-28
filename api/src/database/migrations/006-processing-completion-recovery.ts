import type { MigrationInterface, QueryRunner } from "typeorm";

export class ProcessingCompletionRecovery006 implements MigrationInterface {
  name = "ProcessingCompletionRecovery006";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP FUNCTION public.list_reconcilable_runs(integer);
      CREATE FUNCTION public.list_reconcilable_runs(p_limit integer)
      RETURNS TABLE(id uuid, organization_id uuid, idempotency_key varchar, bull_job_id varchar, state varchar)
      LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $function$
        SELECT r.id, r.organization_id, r.idempotency_key, r.bull_job_id, r.state
        FROM public.processing_runs r
        WHERE r.state IN ('QUEUED','RETRY_SCHEDULED','ACTIVE')
        ORDER BY r.updated_at LIMIT greatest(1, least(p_limit, 100))
      $function$;
      REVOKE ALL ON FUNCTION public.list_reconcilable_runs(integer) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION public.list_reconcilable_runs(integer) TO docdeploy_app;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP FUNCTION public.list_reconcilable_runs(integer);
      CREATE FUNCTION public.list_reconcilable_runs(p_limit integer)
      RETURNS TABLE(id uuid, organization_id uuid, idempotency_key varchar, bull_job_id varchar)
      LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $function$
        SELECT r.id, r.organization_id, r.idempotency_key, r.bull_job_id
        FROM public.processing_runs r WHERE r.state IN ('QUEUED','RETRY_SCHEDULED')
        ORDER BY r.created_at LIMIT greatest(1, least(p_limit, 100))
      $function$;
      REVOKE ALL ON FUNCTION public.list_reconcilable_runs(integer) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION public.list_reconcilable_runs(integer) TO docdeploy_app;
    `);
  }
}
