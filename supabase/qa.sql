-- Run only in a development Supabase project. Everything rolls back.
begin;
do $$
declare a jsonb; b jsonb; yesterday text;
begin
 a:=public.get_fortune('FC001','LOVE'); b:=public.get_fortune('FC001','LOVE');
 assert a=b,'Repeated requests must return identical results';
 assert (a->>'lucky_number')::integer between 1 and 10;
 assert (select count(*) from public.keyrings)=100;
 assert (select count(*) from public.fortune_contents)=120;
 update public.fortune_contents set message='QA content edit' where id=a->>'content_id';
 b:=public.get_fortune('FC001','LOVE');
 assert b->'content'->>'message'='QA content edit','Existing results must reflect current content';
 assert a->>'lucky_number'=b->>'lucky_number';
 assert a->>'lucky_color'=b->>'lucky_color';
 delete from public.daily_results where keyring_id='FC002' and category='LOVE';
 select id into yesterday from public.fortune_contents where category='LOVE' and is_active limit 1;
 insert into public.daily_results(keyring_id,fortune_date,category,content_id,lucky_number,lucky_color) values('FC002',(clock_timestamp() at time zone 'Asia/Seoul')::date-1,'LOVE',yesterday,1,'PINK');
 a:=public.get_fortune('FC002','LOVE'); assert a->>'content_id'<>yesterday;
 update public.keyrings set is_active=false where id='FC003';
 begin perform public.get_fortune('FC003','LOVE'); raise exception 'Inactive ID incorrectly accepted'; exception when others then assert sqlerrm='INVALID_KEYRING'; end;
 assert not has_function_privilege('anon','public.get_fortune(text,text)','execute');
 assert not has_table_privilege('anon','public.daily_results','select');
end $$;
rollback;
