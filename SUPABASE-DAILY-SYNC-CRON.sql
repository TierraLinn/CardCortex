-- CardCortex daily sync scheduler
-- Run this only after deploying the sync-pokemon-catalog Edge Function.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store your sync secret in Supabase Vault first if Vault is available:
-- select vault.create_secret('YOUR_RANDOM_SECRET_HERE', 'cardcortex_sync_secret');

-- If Supabase Vault is not enabled in your project, use the dashboard:
-- Integrations -> Cron -> Create Job
-- URL: https://niqmgpgzffwujvacpgzy.supabase.co/functions/v1/sync-pokemon-catalog
-- Method: POST
-- Header: x-cardcortex-sync-secret = YOUR_RANDOM_SECRET_HERE
-- Body: {"maxPages": 5, "pageSize": 100}
-- Schedule: 0 7 * * *

select cron.schedule(
  'cardcortex-pokemon-catalog-daily-sync',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://niqmgpgzffwujvacpgzy.supabase.co/functions/v1/sync-pokemon-catalog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cardcortex-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cardcortex_sync_secret')
    ),
    body := '{"maxPages": 5, "pageSize": 100}'::jsonb
  );
  $$
);
