begin;

create function public.save_ranking_list(
    p_list jsonb,
    p_entries jsonb,
    p_expected_revision integer default null
)
    returns setof public.ranking_lists
language plpgsql
security invoker
set search_path = ''
as $$
declare
v_owner_id uuid := auth.uid();
    v_list_id uuid;
    v_saved_list public.ranking_lists%rowtype;
begin
    if v_owner_id is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

    if jsonb_typeof(p_list) is distinct from 'object'
        or jsonb_typeof(p_entries) is distinct from 'array'
    then
        raise sqlstate 'PT400'
            using message = 'invalid_ranking_payload';
end if;

    if p_expected_revision < 0 then
        raise sqlstate 'PT400'
            using message = 'invalid_expected_revision';
end if;

    v_list_id := (p_list ->> 'id')::uuid;

    if v_list_id is null then
        raise sqlstate 'PT400'
            using message = 'ranking_id_required';
end if;

    if p_expected_revision is null then
        insert into public.ranking_lists (
            id,
            owner_id,
            title,
            description,
            cover_image_id,
            theme_id,
            accent_color,
            background_image_id
        )
        values (
            v_list_id,
            v_owner_id,
            btrim(p_list ->> 'title'),
            coalesce(p_list ->> 'description', ''),
            (p_list ->> 'cover_image_id')::uuid,
            coalesce(p_list ->> 'theme_id', 'default'),
            p_list ->> 'accent_color',
            (p_list ->> 'background_image_id')::uuid
        )
        returning * into v_saved_list;
else
update public.ranking_lists as list
set
    title = btrim(p_list ->> 'title'),
    description =
        coalesce(p_list ->> 'description', ''),
    cover_image_id =
        (p_list ->> 'cover_image_id')::uuid,
            theme_id =
                coalesce(p_list ->> 'theme_id', 'default'),
            accent_color = p_list ->> 'accent_color',
            background_image_id =
                (p_list ->> 'background_image_id')::uuid,
            updated_at = now(),
            revision = list.revision + 1
where list.id = v_list_id
  and list.owner_id = v_owner_id
  and list.revision = p_expected_revision
    returning list.* into v_saved_list;

if not found then
            raise sqlstate 'PT409'
                using message = 'ranking_revision_conflict';
end if;
end if;

delete from public.ranking_entries
where list_id = v_list_id
  and owner_id = v_owner_id;

insert into public.ranking_entries (
    id,
    owner_id,
    list_id,
    item_id,
    position,
    note
)
select
    entry.id,
    v_owner_id,
    v_list_id,
    entry.item_id,
    entry.position,
    coalesce(entry.note, '')
from jsonb_to_recordset(p_entries) as entry(
                                            id uuid,
                                            item_id uuid,
                                            position bigint,
                                            note text
    );

return next v_saved_list;
return;
end;
$$;

revoke execute on function public.save_ranking_list(
    jsonb, jsonb, integer
    ) from PUBLIC, anon, authenticated;

grant execute on function public.save_ranking_list(
    jsonb, jsonb, integer
) to authenticated;

commit;