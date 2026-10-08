-- Execute privately in Supabase SQL Editor. Never expose these aggregates publicly.
-- NFC activation rate (percent)
select 100.0 * count(*) filter(where exists(select 1 from public.event_logs e where e.keyring_id=k.id and e.event_type='NFC_ENTRY')) / nullif(count(*),0) as activation_percent from public.keyrings k where is_active;
-- Five-minute inactivity sessionization. Raw events remain untouched.
with entries as (
 select keyring_id,created_at,lag(created_at) over(partition by keyring_id order by created_at) as previous from public.event_logs where event_type='NFC_ENTRY'
) select count(*) as nfc_sessions from entries where previous is null or created_at-previous>interval '5 minutes';
-- Return within seven days, on a later KST calendar day.
with firsts as(select keyring_id,min(created_at) as first_at from public.event_logs where event_type in ('NFC_ENTRY','DIRECT_ENTRY') group by keyring_id)
select 100.0*count(*) filter(where exists(select 1 from public.event_logs e where e.keyring_id=f.keyring_id and e.event_type in ('NFC_ENTRY','DIRECT_ENTRY') and (e.created_at at time zone 'Asia/Seoul')::date>(f.first_at at time zone 'Asia/Seoul')::date and e.created_at<=f.first_at+interval '7 days'))/nullif(count(*),0) as return_7d_percent from firsts f;
select category,count(*) as selections,100.0*count(*)/nullif(sum(count(*)) over(),0) as share_percent from public.event_logs where event_type='FORTUNE_SELECT' group by category;
select count(*) filter(where event_type='SHARE_CLICK')::numeric/nullif(count(*) filter(where event_type='FORTUNE_VIEW'),0) as share_attempt_rate,
 count(*) filter(where event_type='SHARE_VISIT')::numeric/nullif(count(*) filter(where event_type='SHARE_CLICK'),0) as visit_per_share,
 count(*) filter(where event_type='PURCHASE_CTA_CLICK' and share_token is not null)::numeric/nullif(count(*) filter(where event_type='SHARE_VISIT'),0) as purchase_per_visit from public.event_logs;
