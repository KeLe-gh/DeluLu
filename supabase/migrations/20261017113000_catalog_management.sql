begin;

create index tier_entries_owner_item_idx
    on public.tier_entries(owner_id, item_id);

grant delete on public.tier_entries to authenticated;

create function public.queue_deleted_catalog_photos()
    returns trigger
    language plpgsql security invoker
set search_path = ''
as $$
begin
insert into public.profile_photo_cleanup (
    owner_id,
    image_id
)
select old.owner_id, image_id
from (
         values
             (old.profile_image_id),
             (old.background_image_id)
     ) as photos(image_id)
where image_id is not null
    on conflict do nothing;

return null;
exception when foreign_key_violation then
    -- Account deletion also removes its cleanup queue.
    return null;
end;
$$;

revoke execute
    on function public.queue_deleted_catalog_photos()
    from PUBLIC, anon;

grant execute
on function public.queue_deleted_catalog_photos()
to authenticated;

create trigger catalog_items_queue_deleted_photos
    after delete on public.catalog_items
    for each row
    execute function public.queue_deleted_catalog_photos();

create function public.delete_catalog_item(
    p_id uuid,
    p_expected_revision integer
)
    returns boolean
    language plpgsql security invoker
set search_path = ''
as $$
declare
item public.catalog_items;
    ranking_ids uuid[];
    tier_ids uuid[];
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

    if p_id is null
       or p_expected_revision is null
       or p_expected_revision < 0 then
        raise exception 'invalid_catalog_deletion'
            using errcode = 'PT400';
end if;

select * into item
from public.catalog_items
where id = p_id
  and owner_id = auth.uid()
    for update;

if not found then
        return true;
end if;

    if item.revision <> p_expected_revision then
        raise exception 'catalog_revision_conflict'
            using errcode = 'PT409';
end if;

    ranking_ids := array(
        select distinct list_id
        from public.ranking_entries
        where item_id = p_id
          and owner_id = auth.uid()
    );

    tier_ids := array(
        select distinct list_id
        from public.tier_entries
        where item_id = p_id
          and owner_id = auth.uid()
    );

begin
        perform id
        from public.ranking_lists
        where owner_id = auth.uid()
          and id = any(ranking_ids)
        order by id
        for update nowait;

perform id
        from public.tier_lists
        where owner_id = auth.uid()
          and id = any(tier_ids)
        order by id
        for update nowait;
exception when lock_not_available then
        raise exception 'list_is_being_changed'
            using errcode = 'PT409';
end;

delete from public.ranking_entries
where owner_id = auth.uid()
  and item_id = p_id;

delete from public.tier_entries
where owner_id = auth.uid()
  and item_id = p_id;

update public.ranking_lists
set revision = revision + 1,
    updated_at = now()
where owner_id = auth.uid()
  and id = any(ranking_ids);

update public.tier_lists
set revision = revision + 1,
    updated_at = now()
where owner_id = auth.uid()
  and id = any(tier_ids);

delete from public.catalog_items
where owner_id = auth.uid()
  and id = p_id;

return true;
end;
$$;

revoke execute
    on function public.delete_catalog_item(uuid, integer)
    from PUBLIC, anon;

grant execute
on function public.delete_catalog_item(uuid, integer)
to authenticated;

commit;