begin;

create sequence public.media_title_order_seq as bigint;
create sequence public.media_thought_order_seq as bigint;

alter table public.media_titles add column sort_order bigint;
alter table public.media_thoughts add column sort_order bigint;

with positions as (
    select id, row_number() over (order by created_at, id) as value
from public.media_titles
    )
update public.media_titles t set sort_order = p.value
    from positions p where p.id = t.id;

with positions as (
    select id, row_number() over (order by created_at, id) as value
from public.media_thoughts
    )
update public.media_thoughts t set sort_order = p.value
    from positions p where p.id = t.id;

select setval(
               'public.media_title_order_seq',
               greatest(coalesce(max(sort_order), 0), 1),
               count(*) > 0
       )
from public.media_titles;

select setval(
               'public.media_thought_order_seq',
               greatest(coalesce(max(sort_order), 0), 1),
               count(*) > 0
       )
from public.media_thoughts;

alter table public.media_titles
    alter column sort_order set not null;

alter table public.media_thoughts
    alter column sort_order set not null;

create index media_titles_manual_order
    on public.media_titles(owner_id, status, sort_order, id);

create index media_thoughts_manual_order
    on public.media_thoughts(owner_id, title_id, sort_order, id);

grant usage on sequence
public.media_title_order_seq,
    public.media_thought_order_seq
to authenticated;

create or replace function public.prepare_media_title()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    perform pg_advisory_xact_lock(hashtextextended(
        'delulu-media:' ||
        (case
            when tg_op = 'INSERT' then new.owner_id
            else old.owner_id
        end)::text,
        0
    ));

    new.name := btrim(new.name);

    if tg_op = 'INSERT' then
        new.revision := 0;
        new.created_at := clock_timestamp();
        new.sort_order := nextval('public.media_title_order_seq');
else
        new.id := old.id;
        new.owner_id := old.owner_id;
        new.created_at := old.created_at;
        new.revision := old.revision + 1;

        if new.status is distinct from old.status then
            new.sort_order := nextval('public.media_title_order_seq');
end if;
end if;

    new.updated_at := clock_timestamp();
return new;
end;
$$;

create or replace function public.prepare_media_thought()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    perform pg_advisory_xact_lock(hashtextextended(
        'delulu-media:' ||
        (case
            when tg_op = 'INSERT' then new.owner_id
            else old.owner_id
        end)::text,
        0
    ));

    new.heading := btrim(new.heading);
    new.body := btrim(new.body);

    if tg_op = 'INSERT' then
        new.revision := 0;
        new.created_at := clock_timestamp();
        new.sort_order := nextval('public.media_thought_order_seq');
else
        new.id := old.id;
        new.owner_id := old.owner_id;
        new.title_id := old.title_id;
        new.created_at := old.created_at;
        new.revision := old.revision + 1;
end if;

    new.updated_at := clock_timestamp();
return new;
end;
$$;

create function public.lock_media_delete()
    returns trigger
    language plpgsql
security invoker
set search_path = ''
as $$
begin
    perform pg_advisory_xact_lock(
        hashtextextended('delulu-media:' || old.owner_id::text, 0)
    );
return old;
end;
$$;

create trigger media_title_delete_lock
    before delete on public.media_titles
    for each row execute function public.lock_media_delete();

create trigger media_thought_delete_lock
    before delete on public.media_thoughts
    for each row execute function public.lock_media_delete();

create function public.apply_media_order(
    p_table text,
    p_scope text,
    p_items jsonb
)
    returns void
    language plpgsql
security definer
set search_path = ''
as $$
declare
owner uuid := auth.uid();
    scope_column text;
    current_items jsonb;
    expected_items jsonb;
begin
    if owner is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

    if p_table = 'media_titles'
       and p_scope in ('watchlist', 'watching', 'watched', 'dropped') then
        scope_column := 'status';
    elsif p_table = 'media_thoughts' and p_scope is not null then
        scope_column := 'title_id';
else
        raise exception 'invalid_scope' using errcode = 'PT400';
end if;

    if jsonb_typeof(p_items) is distinct from 'array' then
        raise exception 'invalid_order' using errcode = 'PT400';
end if;

    if exists (
        select 1
        from jsonb_array_elements(p_items) item
        where jsonb_typeof(item) is distinct from 'object'
           or jsonb_typeof(item->'id') is distinct from 'string'
           or jsonb_typeof(item->'revision') is distinct from 'number'
           or (item->>'revision') !~ '^(0|[1-9][0-9]*)$'
    ) then
        raise exception 'invalid_order' using errcode = 'PT400';
end if;

    if (
select count(distinct item->>'id')
from jsonb_array_elements(p_items) item
    ) <> jsonb_array_length(p_items) then
        raise exception 'duplicate_order_item' using errcode = 'PT400';
end if;

    perform pg_advisory_xact_lock(
        hashtextextended('delulu-media:' || owner::text, 0)
    );

    if p_table = 'media_thoughts' and not exists (
        select 1
        from public.media_titles
        where owner_id = owner and id = p_scope::uuid
    ) then
        raise exception 'title_unavailable' using errcode = 'PT409';
end if;

begin
execute format(
        'select id from public.%I
         where owner_id = $1 and %I::text = $2
         for update nowait',
        p_table,
        scope_column
        ) using owner, p_scope;
exception when lock_not_available then
        raise exception 'order_busy' using errcode = 'PT409';
end;

execute format(
        'select coalesce(
            jsonb_agg(
                jsonb_build_object(''id'', id, ''revision'', revision)
                order by id
            ),
            ''[]''::jsonb
        )
        from public.%I
        where owner_id = $1 and %I::text = $2',
        p_table,
        scope_column
        )
    into current_items
    using owner, p_scope;

select coalesce(
               jsonb_agg(
                       jsonb_build_object(
                               'id', (item->>'id')::uuid,
                               'revision', (item->>'revision')::integer
                       )
                           order by (item->>'id')::uuid
               ),
               '[]'::jsonb
       )
into expected_items
from jsonb_array_elements(p_items) item;

if current_items is distinct from expected_items then
        raise exception 'order_conflict' using errcode = 'PT409';
end if;

execute format(
        'update public.%I t
         set sort_order = desired.position
         from (
             select
                 (value->>''id'')::uuid id,
                 ordinality::bigint position
             from jsonb_array_elements($1) with ordinality
         ) desired
         where t.owner_id = $2
           and t.id = desired.id
           and t.sort_order is distinct from desired.position',
        p_table
        ) using p_items, owner;
end;
$$;

create function public.reorder_media_titles(
    p_status text,
    p_items jsonb
)
    returns setof public.media_titles
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform public.apply_media_order(
        'media_titles', p_status, p_items
    );

return query
select *
from public.media_titles
where owner_id = auth.uid() and status = p_status
order by sort_order, id;
end;
$$;

create function public.reorder_media_thoughts(
    p_title_id uuid,
    p_items jsonb
)
    returns setof public.media_thoughts
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform public.apply_media_order(
        'media_thoughts', p_title_id::text, p_items
    );

return query
select *
from public.media_thoughts
where owner_id = auth.uid() and title_id = p_title_id
order by sort_order, id;
end;
$$;

create function public.delete_media_title(
    p_id uuid,
    p_expected_revision integer
)
    returns boolean
    language plpgsql
security definer
set search_path = ''
as $$
declare
owner uuid := auth.uid();
    saved public.media_titles;
begin
    if owner is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

    perform pg_advisory_xact_lock(
        hashtextextended('delulu-media:' || owner::text, 0)
    );

begin
select *
into saved
from public.media_titles
where owner_id = owner and id = p_id
    for update nowait;

if not found then
            return true;
end if;

        perform 1
        from public.media_thoughts
        where owner_id = owner and title_id = p_id
        for update nowait;
exception when lock_not_available then
        raise exception 'title_busy' using errcode = 'PT409';
end;

    if saved.revision is distinct from p_expected_revision then
        raise exception 'title_conflict' using errcode = 'PT409';
end if;

delete from public.media_titles
where owner_id = owner and id = p_id;

return true;
end;
$$;

revoke execute on function
    public.lock_media_delete(),
    public.apply_media_order(text, text, jsonb)
    from PUBLIC, anon, authenticated;

revoke execute on function
    public.reorder_media_titles(text, jsonb),
    public.reorder_media_thoughts(uuid, jsonb),
    public.delete_media_title(uuid, integer)
    from PUBLIC, anon;

grant execute on function
public.reorder_media_titles(text, jsonb),
    public.reorder_media_thoughts(uuid, jsonb),
    public.delete_media_title(uuid, integer)
to authenticated;

commit;