import type { MigrationInterface, QueryRunner } from "typeorm";

export class ProcessingClaims0025 implements MigrationInterface {
  name = "ProcessingClaims0025";
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE outbox_events ADD COLUMN claimed_at timestamptz, ADD COLUMN claim_token uuid;
      CREATE OR REPLACE FUNCTION public.claim_outbox_events(p_limit integer, p_claim_token uuid)
      RETURNS TABLE(id uuid, organization_id uuid, payload jsonb, idempotency_key varchar)
      LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $function$
        WITH candidates AS (
          SELECT o.id FROM public.outbox_events o
          WHERE o.published_at IS NULL AND (o.claimed_at IS NULL OR o.claimed_at < now() - interval '5 minutes')
          ORDER BY o.created_at FOR UPDATE SKIP LOCKED LIMIT greatest(1, least(p_limit, 100))
        ), claimed AS (
          UPDATE public.outbox_events o SET claimed_at = now(), claim_token = p_claim_token
          FROM candidates c WHERE o.id = c.id
          RETURNING o.id, o.organization_id, o.payload, o.idempotency_key
        ) SELECT * FROM claimed
      $function$;
      CREATE OR REPLACE FUNCTION public.complete_outbox_event(p_id uuid, p_claim_token uuid, p_success boolean, p_failure text)
      RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $function$
        UPDATE public.outbox_events SET
          published_at = CASE WHEN p_success THEN now() ELSE published_at END,
          failure_message = CASE WHEN p_success THEN NULL ELSE left(coalesce(p_failure, 'QUEUE_PUBLISH_FAILED'), 80) END,
          claimed_at = NULL, claim_token = NULL
        WHERE id = p_id AND claim_token = p_claim_token
      $function$;
      CREATE OR REPLACE FUNCTION public.list_reconcilable_runs(p_limit integer)
      RETURNS TABLE(id uuid, organization_id uuid, idempotency_key varchar, bull_job_id varchar)
      LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $function$
        SELECT r.id, r.organization_id, r.idempotency_key, r.bull_job_id
        FROM public.processing_runs r WHERE r.state IN ('QUEUED','RETRY_SCHEDULED')
        ORDER BY r.created_at LIMIT greatest(1, least(p_limit, 100))
      $function$;
      REVOKE ALL ON FUNCTION public.claim_outbox_events(integer, uuid), public.complete_outbox_event(uuid, uuid, boolean, text), public.list_reconcilable_runs(integer) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION public.claim_outbox_events(integer, uuid), public.complete_outbox_event(uuid, uuid, boolean, text), public.list_reconcilable_runs(integer) TO docdeploy_app;
    `);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.claim_outbox_events(integer, uuid), public.complete_outbox_event(uuid, uuid, boolean, text), public.list_reconcilable_runs(integer);
      ALTER TABLE outbox_events DROP COLUMN IF EXISTS claim_token, DROP COLUMN IF EXISTS claimed_at;
    `);
  }
}
