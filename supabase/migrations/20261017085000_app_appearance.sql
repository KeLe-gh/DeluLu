begin;

create table public.app_appearance (
                                       owner_id uuid primary key default auth.uid()
                                           references auth.users(id) on delete cascade,
                                       background_image_id uuid,
                                       revision integer not null default 0 check (revision >= 0),
                                       updated_at timestamptz not null default now()
);

alter table public.app_appearance enable row level security;

create policy app_appearance_owner_access
on public.app_appearance for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

revoke all on public.app_appearance from PUBLIC, anon, authenticated;

grant select on public.app_appearance to authenticated;

grant insert (owner_id, background_image_id)
    on public.app_appearance to authenticated;

grant update (background_image_id)
    on public.app_appearance to authenticated;

create function public.update_app_appearance()
    returns trigger
    language plpgsql
security invoker
set search_path = ''
as $$
begin
    new.revision := old.revision + 1;
    new.updated_at := now();

    if old.background_image_id is not null
       and old.background_image_id is distinct from new.background_image_id then
        insert into public.profile_photo_cleanup (owner_id, image_id)
        values (old.owner_id, old.background_image_id)
        on conflict do nothing;
end if;

return new;
end;
$$;

revoke execute on function public.update_app_appearance() from PUBLIC, anon;
grant execute on function public.update_app_appearance() to authenticated;

create trigger app_appearance_update
    before update on public.app_appearance
    for each row execute function public.update_app_appearance();

drop policy profile_photos_delete_unused on storage.objects;

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
    and not exists (
        select 1
        from public.app_appearance as appearance
        where appearance.owner_id = (select auth.uid())
        and storage.objects.name =
            appearance.owner_id::text || '/' ||
            appearance.background_image_id::text || '.jpg'
    )
);

commit;