begin;

create or replace function public.save_catalog_item(
    p_id uuid,
    p_name text,
    p_description text default '',
    p_profile_image_id uuid default null,
    p_background_image_id uuid default null,
    p_expected_revision integer default null
)
returns setof public.catalog_items
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

    if p_expected_revision is null then
        return query
        insert into public.catalog_items (
            id,
            owner_id,
            name,
            description,
            profile_image_id,
            background_image_id
        )
        values (
            p_id,
            auth.uid(),
            btrim(p_name),
            p_description,
            p_profile_image_id,
            p_background_image_id
        )
        returning *;

        return;
end if;

return query
update public.catalog_items as item
set
    name = btrim(p_name),
    description = p_description,
    profile_image_id = p_profile_image_id,
    background_image_id = p_background_image_id,
    updated_at = now(),
    revision = item.revision + 1
where item.id = p_id
  and item.owner_id = auth.uid()
  and item.revision = p_expected_revision
    returning item.*;

if not found then
        raise sqlstate 'PT409'
            using message = 'catalog_revision_conflict';
end if;

    return;
end;
$$;

commit;