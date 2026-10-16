begin;

create or replace function public.queue_old_profile_photo()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if old.profile_image_id is not null
       and old.profile_image_id is distinct from new.profile_image_id then
        insert into public.profile_photo_cleanup (owner_id, image_id)
        values (old.owner_id, old.profile_image_id)
        on conflict do nothing;
end if;

    if old.background_image_id is not null
       and old.background_image_id is distinct from new.background_image_id then
        insert into public.profile_photo_cleanup (owner_id, image_id)
        values (old.owner_id, old.background_image_id)
        on conflict do nothing;
end if;

return null;
end;
$$;

drop trigger if exists catalog_items_queue_old_photo
    on public.catalog_items;

create trigger catalog_items_queue_old_photo
    after update of profile_image_id, background_image_id
    on public.catalog_items
    for each row execute function public.queue_old_profile_photo();

drop policy if exists profile_photos_delete_unused
    on storage.objects;

create policy profile_photos_delete_unused
on storage.objects for delete to authenticated
using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and owner_id = (select auth.uid())::text
    and not exists (
        select 1
        from public.catalog_items as item
        where item.owner_id = (select auth.uid())
          and (
              storage.objects.name =
                  item.owner_id::text || '/' ||
                  item.profile_image_id::text || '.jpg'
              or storage.objects.name =
                  item.owner_id::text || '/' ||
                  item.background_image_id::text || '.jpg'
          )
    )
);

commit;