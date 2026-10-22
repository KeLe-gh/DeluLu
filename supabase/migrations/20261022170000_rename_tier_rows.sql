begin;

create function public.rename_shared_tier_row(
    p_list_id uuid,
    p_expected_revision integer,
    p_tier_id uuid,
    p_label text
)
    returns integer
    language plpgsql security definer
set search_path = ''
as $$
declare
list public.tier_lists;
    tier public.tier_rows;
    v_label text := btrim(p_label);
begin
    list := public.lock_shared_tier(p_list_id, p_expected_revision);

    if list.style_id <> 'classic' then
        raise exception 'tier_labels_unavailable'
            using errcode = 'PT400';
end if;

    if v_label is null
       or char_length(v_label) not between 1 and 32
       or v_label ~ '[[:cntrl:]]' then
        raise exception 'invalid_tier_label'
            using errcode = 'PT400';
end if;

select * into tier
from public.tier_rows
where id = p_tier_id
  and list_id = list.id
  and owner_id = list.owner_id;

if tier.id is null then
        raise exception 'tier_unavailable'
            using errcode = 'PT404';
end if;

    if tier.label = v_label then
        return list.revision;
end if;

update public.tier_rows
set label = v_label
where id = tier.id
  and list_id = list.id
  and owner_id = list.owner_id;

update public.tier_lists
set revision = revision + 1,
    updated_at = now()
where id = list.id;

return list.revision + 1;
end;
$$;

revoke all on function public.rename_shared_tier_row(
    uuid, integer, uuid, text
    ) from PUBLIC, anon, authenticated;

grant execute on function public.rename_shared_tier_row(
    uuid, integer, uuid, text
) to authenticated;

commit;