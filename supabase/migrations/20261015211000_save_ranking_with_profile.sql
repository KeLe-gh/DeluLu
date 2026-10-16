begin;

create function public.save_ranking_with_profile(
    p_list jsonb,
    p_entries jsonb,
    p_expected_revision integer default null,
    p_catalog_item jsonb default null,
    p_catalog_expected_revision integer default null
)
    returns jsonb
    language plpgsql
security invoker
set search_path = ''
as $$
declare
v_saved_list public.ranking_lists%rowtype;
    v_saved_item jsonb := null;
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

    if jsonb_typeof(p_list) is distinct from 'object'
        or jsonb_typeof(p_entries) is distinct from 'array'
    then
        raise sqlstate 'PT400'
            using message = 'invalid_ranking_payload';
end if;

    if p_catalog_item is null then
        if p_catalog_expected_revision is not null then
            raise sqlstate 'PT400'
                using message = 'catalog_item_required';
end if;
else
        if jsonb_typeof(p_catalog_item)
            is distinct from 'object'
        then
            raise sqlstate 'PT400'
                using message = 'invalid_catalog_payload';
end if;

        if p_catalog_expected_revision < 0 then
            raise sqlstate 'PT400'
                using message = 'invalid_catalog_revision';
end if;

        if not exists (
            select 1
            from jsonb_array_elements(p_entries) as entry(value)
            where (entry.value ->> 'item_id')::uuid =
                (p_catalog_item ->> 'id')::uuid
        ) then
            raise sqlstate 'PT400'
                using message = 'profile_not_in_ranking';
end if;

select to_jsonb(item)
into strict v_saved_item
from public.save_catalog_item(
    p_id => (p_catalog_item ->> 'id')::uuid,
    p_name => p_catalog_item ->> 'name',
    p_description =>
    coalesce(p_catalog_item ->> 'description', ''),
    p_profile_image_id =>
    (p_catalog_item ->> 'profile_image_id')::uuid,
    p_background_image_id =>
    (p_catalog_item ->> 'background_image_id')::uuid,
    p_expected_revision =>
    p_catalog_expected_revision
    ) as item;
end if;

select *
into strict v_saved_list
from public.save_ranking_list(
    p_list => p_list,
    p_entries => p_entries,
    p_expected_revision => p_expected_revision
    );

return jsonb_build_object(
        'ranking_list', to_jsonb(v_saved_list),
        'catalog_item', v_saved_item
       );
end;
$$;

revoke execute on function public.save_ranking_with_profile(
    jsonb, jsonb, integer, jsonb, integer
    ) from PUBLIC, anon, authenticated;

grant execute on function public.save_ranking_with_profile(
    jsonb, jsonb, integer, jsonb, integer
) to authenticated;

commit;