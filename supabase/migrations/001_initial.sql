begin;
create table public.keyrings (
 id text primary key check (id ~ '^FC(00[1-9]|0[1-9][0-9]|100)$'),
 is_active boolean not null default true, created_at timestamptz not null default now(), activated_at timestamptz
);
create table public.fortune_contents (
 id text primary key, category text not null check(category in ('MONEY','LOVE','WORK','LUCK')),
 message text not null, mission text not null, score integer not null check(score between 0 and 100),
 is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,category)
);
create table public.daily_results (
 id uuid primary key default gen_random_uuid(), keyring_id text not null references public.keyrings(id),
 fortune_date date not null, category text not null check(category in ('MONEY','LOVE','WORK','LUCK')),
 content_id text not null, lucky_number integer not null check(lucky_number between 1 and 10),
 lucky_color text not null check(lucky_color in ('RED','ORANGE','YELLOW','GREEN','BLUE','PURPLE','PINK','WHITE','BLACK','BEIGE','SKY_BLUE','LIGHT_GREEN')),
 created_at timestamptz not null default now(), unique(keyring_id,fortune_date,category),
 foreign key(content_id,category) references public.fortune_contents(id,category)
);
create table public.share_links (
 id uuid primary key default gen_random_uuid(), token text not null unique default replace(gen_random_uuid()::text,'-',''),
 daily_result_id uuid not null unique references public.daily_results(id), created_at timestamptz not null default now()
);
create table public.event_logs (
 id uuid primary key default gen_random_uuid(), keyring_id text references public.keyrings(id),
 event_type text not null check(event_type in ('NFC_ENTRY','DIRECT_ENTRY','FORTUNE_SELECT','FORTUNE_VIEW','SHARE_CLICK','SHARE_VISIT','PURCHASE_CTA_CLICK','BACK_TO_HOME','INVALID_ID','SYSTEM_ERROR')),
 category text check(category in ('MONEY','LOVE','WORK','LUCK')), daily_result_id uuid references public.daily_results(id),
 share_token text, error_type text, created_at timestamptz not null default now()
);
create index event_logs_type_time on public.event_logs(event_type,created_at);
create index event_logs_keyring_time on public.event_logs(keyring_id,created_at);
alter table public.keyrings enable row level security;
alter table public.fortune_contents enable row level security;
alter table public.daily_results enable row level security;
alter table public.share_links enable row level security;
alter table public.event_logs enable row level security;
revoke all on public.keyrings,public.fortune_contents,public.daily_results,public.share_links,public.event_logs from anon,authenticated;
grant all on public.keyrings,public.fortune_contents,public.daily_results,public.share_links,public.event_logs to service_role;

create function public.touch_content() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end; $$;
create trigger content_updated before update on public.fortune_contents for each row execute function public.touch_content();

create function public.get_fortune(p_keyring text,p_category text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 d date; r public.daily_results; candidate text; yesterday text;
 palette text[] := array['RED','ORANGE','YELLOW','GREEN','BLUE','PURPLE','PINK','WHITE','BLACK','BEIGE','SKY_BLUE','LIGHT_GREEN'];
begin
 if p_category not in ('MONEY','LOVE','WORK','LUCK') then raise exception 'INVALID_CATEGORY'; end if;
 -- Serialize all generation on this keyring, including requests near midnight.
 perform 1 from public.keyrings where id=p_keyring and is_active for update;
 if not found then raise exception 'INVALID_KEYRING'; end if;
 d := (clock_timestamp() at time zone 'Asia/Seoul')::date;
 select * into r from public.daily_results where keyring_id=p_keyring and fortune_date=d and category=p_category;
 if not found then
  select content_id into yesterday from public.daily_results where keyring_id=p_keyring and fortune_date=d-1 and category=p_category;
  select id into candidate from public.fortune_contents where category=p_category and is_active and id is distinct from yesterday order by random() limit 1;
  if candidate is null then raise exception 'NO_ACTIVE_CONTENT'; end if;
  insert into public.daily_results(keyring_id,fortune_date,category,content_id,lucky_number,lucky_color)
  values(p_keyring,d,p_category,candidate,1+floor(random()*10)::integer,palette[1+floor(random()*12)::integer]) returning * into r;
 end if;
 return to_jsonb(r) || jsonb_build_object('content',(select to_jsonb(c) from public.fortune_contents c where c.id=r.content_id));
end; $$;
revoke execute on function public.get_fortune(text,text) from public,anon,authenticated;
grant execute on function public.get_fortune(text,text) to service_role;
revoke execute on function public.touch_content() from public,anon,authenticated;
insert into public.keyrings(id) select 'FC'||lpad(i::text,3,'0') from generate_series(1,100) i;
commit;
