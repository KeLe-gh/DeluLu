begin;

create sequence public.ranking_list_sort_order_seq
    as bigint
    minvalue 1
    maxvalue 9007199254740991;

alter table public.ranking_lists
    add column sort_order bigint;

with ordered_lists as (
    select
        id,
        row_number() over (
            order by created_at, id
        ) as sort_order
    from public.ranking_lists
)
update public.ranking_lists as list
set sort_order = ordered.sort_order
    from ordered_lists as ordered
where list.id = ordered.id;

select setval(
               'public.ranking_list_sort_order_seq'::regclass,
               coalesce(max(sort_order), 0) + 1,
               false
       )
from public.ranking_lists;

alter table public.ranking_lists
    alter column sort_order
        set default nextval(
            'public.ranking_list_sort_order_seq'::regclass
                    ),
alter column sort_order set not null,
    add constraint ranking_lists_sort_order_range
        check (
            sort_order >= 1
            and sort_order <= 9007199254740991
        );

alter sequence public.ranking_list_sort_order_seq
    owned by public.ranking_lists.sort_order;

create index ranking_lists_owner_sort_order_idx
    on public.ranking_lists(owner_id, sort_order, id);

revoke all privileges
    on sequence public.ranking_list_sort_order_seq
    from PUBLIC, anon, authenticated;

grant usage
    on sequence public.ranking_list_sort_order_seq
    to authenticated;

create function public.delete_ranking_list(
    p_id uuid,
    p_expected_revision integer
)
    returns void
    language plpgsql
security invoker
set search_path = ''
as $$
declare
v_deleted_id uuid;
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

    if p_id is null
        or p_expected_revision is null
        or p_expected_revision < 0
    then
        raise sqlstate 'PT400'
            using message = 'invalid_delete_payload';
end if;

delete from public.ranking_lists as list
where list.id = p_id
  and list.owner_id = auth.uid()
  and list.revision = p_expected_revision
    returning list.id into v_deleted_id;

if v_deleted_id is null then
        raise sqlstate 'PT409'
            using message = 'ranking_revision_conflict';
end if;
end;
$$;

create function public.reorder_ranking_lists(
    p_lists jsonb
)
    returns void
    language plpgsql
security invoker
set search_path = ''
as $$
declare
v_owner_id uuid := auth.uid();
    v_list_count bigint;
begin
    if v_owner_id is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

    if jsonb_typeof(p_lists) is distinct from 'array' then
        raise sqlstate 'PT400'
            using message = 'invalid_reorder_payload';
end if;

    if exists (
        select 1
        from jsonb_array_elements(p_lists) as entry(value)
        where jsonb_typeof(entry.value)
                is distinct from 'object'
            or entry.value ->> 'id' is null
            or jsonb_typeof(entry.value -> 'revision')
                is distinct from 'number'
    ) then
        raise sqlstate 'PT400'
            using message = 'invalid_reorder_payload';
end if;

    if (
select count(
               distinct (entry.value ->> 'id')::uuid
       )
from jsonb_array_elements(p_lists) as entry(value)
    ) <> jsonb_array_length(p_lists) then
        raise sqlstate 'PT400'
            using message = 'duplicate_ranking_ids';
end if;

    perform list.id
    from public.ranking_lists as list
    where list.owner_id = v_owner_id
    order by list.id
    for update;

select count(*)
into v_list_count
from public.ranking_lists
where owner_id = v_owner_id;

if v_list_count <> jsonb_array_length(p_lists) then
        raise sqlstate 'PT409'
            using message = 'ranking_collection_conflict';
end if;

    if exists (
        select 1
        from jsonb_array_elements(p_lists) as entry(value)
        left join public.ranking_lists as list
            on list.id = (entry.value ->> 'id')::uuid
            and list.owner_id = v_owner_id
        where list.id is null
            or list.revision is distinct from
                (entry.value ->> 'revision')::integer
    ) then
        raise sqlstate 'PT409'
            using message = 'ranking_revision_conflict';
end if;

update public.ranking_lists as list
set
    sort_order = desired.sort_order,
    revision = list.revision + 1,
    updated_at = now()
    from jsonb_array_elements(p_lists)
with ordinality as desired(value, sort_order)
where list.id = (desired.value ->> 'id')::uuid
  and list.owner_id = v_owner_id;
end;
$$;

revoke execute on function public.delete_ranking_list(
    uuid, integer
    ) from PUBLIC, anon, authenticated;

grant execute on function public.delete_ranking_list(
    uuid, integer
) to authenticated;

revoke execute on function public.reorder_ranking_lists(
    jsonb
    ) from PUBLIC, anon, authenticated;

grant execute on function public.reorder_ranking_lists(
    jsonb
) to authenticated;

commit;