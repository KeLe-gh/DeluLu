begin;

grant update (tier_id, position)
    on public.tier_entries to authenticated;

create function public.move_tier_entry(
    p_list_id uuid,
    p_entry_id uuid,
    p_tier_id uuid,
    p_index integer,
    p_expected_revision integer
)
    returns setof public.tier_lists
language plpgsql security invoker
set search_path = ''
as $$
declare
saved_list public.tier_lists;
    target_count integer;
    insertion_position numeric;
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

    if p_list_id is null
       or p_entry_id is null
       or p_index is null
       or p_index < 0
       or p_expected_revision is null
       or p_expected_revision < 0 then
        raise exception 'invalid_tier_move'
            using errcode = 'PT400';
end if;

select * into saved_list
from public.tier_lists
where id = p_list_id
  and owner_id = auth.uid()
    for update;

if not found then
        raise exception 'tier_list_not_found'
            using errcode = 'PT404';
end if;

    if saved_list.revision <> p_expected_revision then
        raise exception 'tier_revision_conflict'
            using errcode = 'PT409';
end if;

    if not exists (
        select 1
        from public.tier_entries
        where id = p_entry_id
          and list_id = p_list_id
          and owner_id = auth.uid()
    ) then
        raise exception 'tier_entry_not_found'
            using errcode = 'PT404';
end if;

    if p_tier_id is not null and not exists (
        select 1
        from public.tier_rows
        where id = p_tier_id
          and list_id = p_list_id
          and owner_id = auth.uid()
    ) then
        raise exception 'tier_not_found'
            using errcode = 'PT404';
end if;

select count(*) into target_count
from public.tier_entries
where owner_id = auth.uid()
  and list_id = p_list_id
  and id <> p_entry_id
  and tier_id is not distinct from p_tier_id;

if p_index > target_count then
        raise exception 'invalid_tier_position'
            using errcode = 'PT400';
end if;

select position - 0.5 into insertion_position
from public.tier_entries
where owner_id = auth.uid()
  and list_id = p_list_id
  and id <> p_entry_id
  and tier_id is not distinct from p_tier_id
order by position
offset p_index
    limit 1;

if insertion_position is null then
select coalesce(
               max(position) + 0.5,
               (
                   select coalesce(max(position), 0) + 1
                   from public.tier_entries
                   where owner_id = auth.uid()
                     and list_id = p_list_id
               )
       )
into insertion_position
from public.tier_entries
where owner_id = auth.uid()
  and list_id = p_list_id
  and id <> p_entry_id
  and tier_id is not distinct from p_tier_id;
end if;

with ordered as (
    select
        id,
        row_number() over (
                order by case
                    when id = p_entry_id
                        then insertion_position
                    else position
                end
            )::integer as new_position
    from public.tier_entries
    where owner_id = auth.uid()
      and list_id = p_list_id
)
update public.tier_entries as entry
set
    position = ordered.new_position,
    tier_id = case
                  when entry.id = p_entry_id then p_tier_id
                  else entry.tier_id
        end
    from ordered
where entry.id = ordered.id;

update public.tier_lists
set revision = revision + 1,
    updated_at = now()
where id = p_list_id
  and owner_id = auth.uid()
    returning * into saved_list;

return next saved_list;
end;
$$;

revoke execute on function public.move_tier_entry(
    uuid, uuid, uuid, integer, integer
    ) from PUBLIC, anon;

grant execute on function public.move_tier_entry(
    uuid, uuid, uuid, integer, integer
) to authenticated;

commit;