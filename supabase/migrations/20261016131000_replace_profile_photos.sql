begin;

create table public.profile_photo_cleanup (
                                              owner_id uuid not null references auth.users(id) on delete cascade,
                                              image_id uuid not null,
                                              created_at timestamptz not null default now(),
                                              primary key (owner_id, image_id)
);

alter table public.profile_photo_cleanup enable row level security;

create policy profile_photo_cleanup_owner_access
on public.profile_photo_cleanup for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

revoke all on public.profile_photo_cleanup from PUBLIC, anon, authenticated;
grant select, insert, delete on public.profile_photo_cleanup to authenticated;

create function public.queue_old_profile_photo()
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
return null;
end;
$$;

revoke execute on function public.queue_old_profile_photo() from PUBLIC, anon;
grant execute on function public.queue_old_profile_photo() to authenticated;

create trigger catalog_items_queue_old_photo
    after update of profile_image_id on public.catalog_items
    for each row execute function public.queue_old_profile_photo();

drop policy profile_photos_delete_own on storage.objects;

create policy profile_photos_delete_unused
on storage.objects for delete to authenticated
using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and owner_id = (select auth.uid())::text
    and not exists (
        select 1 from public.catalog_items as item
        where item.owner_id = (select auth.uid())
          and storage.objects.name =
              item.owner_id::text || '/' || item.profile_image_id::text || '.jpg'
    )
);

commit;