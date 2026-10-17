begin;

grant update (title) on public.tier_lists to authenticated;
grant delete on public.tier_lists to authenticated;

create function public.rename_tier_list(
    p_id uuid,
    p_title text,
    p_expected_revision integer
)
    returns setof public.tier_lists
language plpgsql security invoker
set search_path = ''
as $$
declare
saved public.tier_lists;
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

    if p_id is null
       or p_title is null
       or char_length(btrim(p_title)) not between 1 and 120
       or p_expected_revision is null
       or p_expected_revision < 0 then
        raise exception 'invalid_tier_rename'
            using errcode = 'PT400';
end if;

update public.tier_lists
set title = btrim(p_title),
    revision = revision + 1,
    updated_at = now()
where id = p_id
  and owner_id = auth.uid()
  and revision = p_expected_revision
    returning * into saved;

if not found then
        raise exception 'tier_revision_conflict'
            using errcode = 'PT409';
end if;

return next saved;
end;
$$;

create function public.delete_tier_list(
    p_id uuid,
    p_expected_revision integer
)
    returns boolean
    language plpgsql security invoker
set search_path = ''
as $$
declare
deleted_id uuid;
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

    if p_id is null
       or p_expected_revision is null
       or p_expected_revision < 0 then
        raise exception 'invalid_tier_deletion'
            using errcode = 'PT400';
end if;

delete from public.tier_lists
where id = p_id
  and owner_id = auth.uid()
  and revision = p_expected_revision
    returning id into deleted_id;

if deleted_id is null and exists (
        select 1
        from public.tier_lists
        where id = p_id
          and owner_id = auth.uid()
    ) then
        raise exception 'tier_revision_conflict'
            using errcode = 'PT409';
end if;

return true;
end;
$$;

revoke execute
    on function public.rename_tier_list(uuid, text, integer)
    from PUBLIC, anon;

grant execute
on function public.rename_tier_list(uuid, text, integer)
to authenticated;

revoke execute
    on function public.delete_tier_list(uuid, integer)
    from PUBLIC, anon;

grant execute
on function public.delete_tier_list(uuid, integer)
to authenticated;

commit;