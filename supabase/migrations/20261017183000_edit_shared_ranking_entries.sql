begin;

create function public.update_shared_ranking_entries(
    p_list_id uuid,
    p_expected_revision integer,
    p_entries jsonb
)
    returns integer
    language plpgsql
security definer
set search_path = ''
as $$
declare
saved_list public.ranking_lists;
    saved_revision integer;
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

    if p_list_id is null
       or p_expected_revision is null
       or p_expected_revision < 0
       or jsonb_typeof(p_entries) is distinct from 'array'
    then
        raise exception 'invalid_entry_changes'
            using errcode = 'PT400';
end if;

begin
select * into saved_list
from public.ranking_lists
where id = p_list_id
  and (
    owner_id = auth.uid()
        or exists (
        select 1
        from public.ranking_members
        where list_id = p_list_id
          and user_id = auth.uid()
    )
    )
    for update nowait;
exception when lock_not_available then
        raise exception 'ranking_is_being_changed'
            using errcode = 'PT409';
end;

    -- Membership changes use this same list lock.
    if saved_list.id is null
       or (
           saved_list.owner_id <> auth.uid()
           and not exists (
               select 1
               from public.ranking_members
               where list_id = p_list_id
                 and user_id = auth.uid()
           )
       )
    then
        raise exception 'ranking_unavailable'
            using errcode = 'PT404';
end if;

    if saved_list.revision <> p_expected_revision then
        raise exception 'ranking_revision_conflict'
            using errcode = 'PT409';
end if;

    if exists (
        select 1
        from jsonb_array_elements(p_entries) as changes(value)
        where jsonb_typeof(value) is distinct from 'object'
           or jsonb_typeof(value -> 'id') is distinct from 'string'
           or (value ->> 'id') !~*
               '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           or jsonb_typeof(value -> 'position') is distinct from 'number'
           or (value - 'id' - 'position') <> '{}'::jsonb
    ) then
        raise exception 'invalid_entry_changes'
            using errcode = 'PT400';
end if;

    if exists (
        select 1
        from jsonb_array_elements(p_entries) as changes(value)
        where (value ->> 'position')::numeric < 1
           or (value ->> 'position')::numeric > 9007199254740991
           or trunc((value ->> 'position')::numeric)
                <> (value ->> 'position')::numeric
    ) then
        raise exception 'invalid_entry_position'
            using errcode = 'PT400';
end if;

    if (
select
    count(*) <> count(distinct (value ->> 'id')::uuid)
        or count(*) <> count(
            distinct (value ->> 'position')::numeric
                       )
from jsonb_array_elements(p_entries) as changes(value)
    ) then
        raise exception 'duplicate_entry_or_position'
            using errcode = 'PT400';
end if;

    -- Only this list's existing entries can be moved or removed.
    if exists (
        select 1
        from jsonb_to_recordset(p_entries)
            as changes(id uuid, position numeric)
        where not exists (
            select 1
            from public.ranking_entries entry
            where entry.id = changes.id
              and entry.list_id = p_list_id
              and entry.owner_id = saved_list.owner_id
        )
    ) then
        raise exception 'invalid_entry_changes'
            using errcode = 'PT400';
end if;

delete from public.ranking_entries entry
where entry.list_id = p_list_id
  and entry.owner_id = saved_list.owner_id
  and not exists (
    select 1
    from jsonb_to_recordset(p_entries)
             as changes(id uuid)
    where changes.id = entry.id
);

update public.ranking_entries entry
set position = changes.position::bigint
from jsonb_to_recordset(p_entries)
    as changes(id uuid, position numeric)
where entry.id = changes.id
  and entry.list_id = p_list_id
  and entry.owner_id = saved_list.owner_id;

update public.ranking_lists
set
    revision = revision + 1,
    updated_at = now()
where id = p_list_id
    returning revision into saved_revision;

return saved_revision;
end;
$$;

revoke execute on function
    public.update_shared_ranking_entries(uuid, integer, jsonb)
    from PUBLIC, anon;

grant execute on function
public.update_shared_ranking_entries(uuid, integer, jsonb)
to authenticated;

commit;