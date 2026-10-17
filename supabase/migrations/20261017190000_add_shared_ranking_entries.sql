begin;

create table public.ranking_photo_uploads (
                                              image_id uuid primary key default gen_random_uuid(),
                                              owner_id uuid not null references auth.users(id) on delete cascade,
                                              uploader_id uuid references auth.users(id) on delete set null,
                                              list_id uuid references public.ranking_lists(id) on delete set null,
                                              expires_at timestamptz not null default (now() + interval '1 hour')
);

create table public.ranking_catalog_sources (
                                                item_id uuid primary key references public.catalog_items(id) on delete cascade,
                                                source_user_id uuid references auth.users(id) on delete set null,
                                                source_item_id uuid not null
);

create index ranking_catalog_sources_lookup
    on public.ranking_catalog_sources(source_user_id, source_item_id);

alter table public.ranking_photo_uploads enable row level security;
alter table public.ranking_catalog_sources enable row level security;

revoke all on public.ranking_photo_uploads, public.ranking_catalog_sources
    from PUBLIC, anon, authenticated;

create function public.reserve_ranking_photo(
    p_list_id uuid,
    p_expected_revision integer
)
    returns jsonb
    language plpgsql security definer set search_path = ''
as $$
declare
list public.ranking_lists;
    photo public.ranking_photo_uploads;
begin
    if auth.uid() is null then
        raise exception 'authentication_required' using errcode='42501';
end if;

select * into list
from public.ranking_lists
where id=p_list_id and (
    owner_id=auth.uid() or exists (
        select 1 from public.ranking_members
        where list_id=p_list_id and user_id=auth.uid()
    )
    );

if list.id is null then
        raise exception 'ranking_unavailable' using errcode='PT404';
end if;

    if p_expected_revision is null or list.revision<>p_expected_revision then
        raise exception 'ranking_revision_conflict' using errcode='PT409';
end if;

insert into public.ranking_photo_uploads(owner_id,uploader_id,list_id)
values(list.owner_id,auth.uid(),list.id)
    returning * into photo;

return jsonb_build_object(
        'owner_id',photo.owner_id,
        'image_id',photo.image_id
       );
end;
$$;

create function public.can_upload_ranking_photo(p_name text)
    returns boolean
    language sql stable security definer set search_path = ''
as $$
select exists (
    select 1
    from public.ranking_photo_uploads upload
             join public.ranking_lists list
                  on list.id=upload.list_id and list.owner_id=upload.owner_id
    where upload.uploader_id=auth.uid()
      and upload.expires_at>now()
      and p_name=upload.owner_id::text||'/'||upload.image_id::text||'.jpg'
        and (
                                                                list.owner_id=auth.uid() or exists (
                                                                    select 1 from public.ranking_members
                                                                    where list_id=list.id and user_id=auth.uid()
                                                                )
                                                                )
);
$$;

drop policy profile_photos_read_own on storage.objects;

create policy profile_photos_read_own
on storage.objects for select to authenticated
                                       using (
                                       bucket_id='profile-photos'
                                       and (storage.foldername(name))[1]=(select auth.uid())::text
                                       );

create function public.can_read_pending_ranking_photo(p_name text)
    returns boolean
    language sql stable security definer set search_path = ''
as $$
select exists (
    select 1 from public.ranking_photo_uploads
    where uploader_id=auth.uid()
      and p_name=owner_id::text||'/'||image_id::text||'.jpg'
);
$$;

create policy profile_photos_read_pending_ranking
on storage.objects for select to authenticated
                                  using (
                                  bucket_id='profile-photos'
                                  and public.can_read_pending_ranking_photo(name)
                                  );

create policy profile_photos_upload_ranking
on storage.objects for insert to authenticated
with check (
    bucket_id='profile-photos'
    and owner_id=(select auth.uid())::text
    and public.can_upload_ranking_photo(name)
);

create function public.can_delete_profile_photo(p_name text)
    returns boolean
    language plpgsql volatile security definer set search_path = ''
as $$
begin
    if auth.uid() is null or not (
        split_part(p_name,'/',1)=auth.uid()::text or exists (
            select 1 from public.ranking_photo_uploads upload
            where upload.uploader_id=auth.uid()
              and (upload.expires_at<=now() or upload.list_id is null)
              and p_name=upload.owner_id::text||'/'||upload.image_id::text||'.jpg'
        )
    ) then
        return false;
end if;

    if not pg_try_advisory_xact_lock(hashtextextended(p_name,0)) then
        return false;
end if;

return not exists (
    select 1 from public.ranking_photo_uploads upload
    where upload.expires_at>now()
      and upload.list_id is not null
      and p_name=upload.owner_id::text||'/'||upload.image_id::text||'.jpg'
)
    and not exists (
        select 1 from public.catalog_items item
        where p_name=item.owner_id::text||'/'||item.profile_image_id::text||'.jpg'
            or p_name=item.owner_id::text||'/'||item.background_image_id::text||'.jpg'
    )
    and not exists (
        select 1 from public.app_appearance appearance
        where p_name=appearance.owner_id::text||'/'||appearance.background_image_id::text||'.jpg'
    )
    and not exists (
        select 1 from public.ranking_lists list
        where p_name=list.owner_id::text||'/'||list.cover_image_id::text||'.jpg'
            or p_name=list.owner_id::text||'/'||list.background_image_id::text||'.jpg'
    );
end;
$$;

drop policy profile_photos_delete_unused on storage.objects;

create policy profile_photos_delete_unused
on storage.objects for delete to authenticated
using (
    bucket_id='profile-photos'
    and public.can_delete_profile_photo(name)
);

create function public.cancel_ranking_photo(p_image_id uuid)
    returns void
    language sql security definer set search_path = ''
as $$
update public.ranking_photo_uploads
set expires_at=now()
where image_id=p_image_id and uploader_id=auth.uid();
$$;

create function public.list_profile_photo_cleanup()
    returns table(owner_id uuid,image_id uuid)
    language sql stable security definer set search_path = ''
as $$
select queue.owner_id,queue.image_id
from public.profile_photo_cleanup queue
where queue.owner_id=auth.uid()

union

select upload.owner_id,upload.image_id
from public.ranking_photo_uploads upload
where (upload.owner_id=auth.uid() or upload.uploader_id=auth.uid())
  and (upload.expires_at<=now() or upload.list_id is null)

    limit 50;
$$;

create function public.ack_profile_photo_cleanup(
    p_owner_id uuid,
    p_image_id uuid
)
    returns boolean
    language plpgsql security definer set search_path = ''
as $$
begin
    if auth.uid() is null then
        return false;
end if;

    if p_owner_id<>auth.uid() and not exists (
        select 1 from public.ranking_photo_uploads
        where owner_id=p_owner_id and image_id=p_image_id
          and uploader_id=auth.uid()
          and (expires_at<=now() or list_id is null)
    ) then
        return false;
end if;

    if exists (
        select 1 from public.ranking_photo_uploads
        where owner_id=p_owner_id and image_id=p_image_id
          and expires_at>now() and list_id is not null
    ) then
        return false;
end if;

    if exists (
        select 1 from storage.objects
        where bucket_id='profile-photos'
          and name=p_owner_id::text||'/'||p_image_id::text||'.jpg'
    ) then
        return false;
end if;

delete from public.profile_photo_cleanup
where owner_id=p_owner_id and image_id=p_image_id;

delete from public.ranking_photo_uploads
where owner_id=p_owner_id and image_id=p_image_id;

return true;
end;
$$;

create function public.list_ranking_add_catalog(p_list_id uuid)
    returns setof public.catalog_items
language plpgsql stable security definer set search_path = ''
as $$
begin
    if not exists (
        select 1 from public.ranking_lists
        where id=p_list_id and (
            owner_id=auth.uid() or exists (
                select 1 from public.ranking_members
                where list_id=p_list_id and user_id=auth.uid()
            )
        )
    ) then
        raise exception 'ranking_unavailable' using errcode='PT404';
end if;

return query
select item.*
from public.catalog_items item
where item.owner_id=auth.uid()
  and not exists (
    select 1 from public.ranking_entries
    where list_id=p_list_id and item_id=item.id
)
  and not exists (
    select 1
    from public.ranking_catalog_sources source
             join public.ranking_entries entry on entry.item_id=source.item_id
    where entry.list_id=p_list_id
      and source.source_user_id=auth.uid()
      and source.source_item_id=item.id
);
end;
$$;

create function public.add_shared_ranking_entry(
    p_list_id uuid,
    p_expected_revision integer,
    p_entry_id uuid,
    p_position bigint,
    p_name text default null,
    p_source_item_id uuid default null,
    p_source_expected_revision integer default null,
    p_profile_image_id uuid default null,
    p_background_image_id uuid default null
)
    returns integer
    language plpgsql security definer set search_path = ''
as $$
declare
list public.ranking_lists;
    source public.catalog_items;
    target_id uuid;
    image uuid;
begin
    if auth.uid() is null then
        raise exception 'authentication_required' using errcode='42501';
end if;

begin
select * into list
from public.ranking_lists
where id=p_list_id and (
    owner_id=auth.uid() or exists (
        select 1 from public.ranking_members
        where list_id=p_list_id and user_id=auth.uid()
    )
    )
    for update nowait;
exception when lock_not_available then
        raise exception 'ranking_is_being_changed' using errcode='PT409';
end;

    if list.id is null or (
        list.owner_id<>auth.uid() and not exists (
            select 1 from public.ranking_members
            where list_id=p_list_id and user_id=auth.uid()
        )
    ) then
        raise exception 'ranking_unavailable' using errcode='PT404';
end if;

    if p_expected_revision is null or list.revision<>p_expected_revision then
        raise exception 'ranking_revision_conflict' using errcode='PT409';
end if;

    if p_entry_id is null
       or p_position is null
       or p_position<1
       or p_position>9007199254740991
    then
        raise exception 'invalid_entry' using errcode='PT400';
end if;

    if exists (
        select 1 from public.ranking_entries where id=p_entry_id
    ) then
        raise exception 'entry_already_exists' using errcode='PT409';
end if;

    if p_source_item_id is not null then
begin
select * into source
from public.catalog_items
where id=p_source_item_id and owner_id=auth.uid()
    for share nowait;
exception when lock_not_available then
            raise exception 'catalog_is_being_changed' using errcode='PT409';
end;

        if source.id is null
           or p_source_expected_revision is null
           or source.revision<>p_source_expected_revision
        then
            raise exception 'catalog_revision_conflict' using errcode='PT409';
end if;

        if exists (
            select 1
            from public.ranking_catalog_sources origin
            join public.ranking_entries entry on entry.item_id=origin.item_id
            where entry.list_id=p_list_id
              and origin.source_user_id=auth.uid()
              and origin.source_item_id=source.id
        ) or exists (
            select 1 from public.ranking_entries
            where list_id=p_list_id and item_id=source.id
        ) then
            raise exception 'profile_already_added' using errcode='PT409';
end if;

        if source.owner_id=list.owner_id then
            if p_profile_image_id is not null
               or p_background_image_id is not null
            then
                raise exception 'unexpected_photo' using errcode='PT400';
end if;

            target_id:=source.id;
        elsif (source.profile_image_id is null)<>(p_profile_image_id is null)
           or (source.background_image_id is null)<>(p_background_image_id is null)
        then
            raise exception 'copied_photos_required' using errcode='PT400';
end if;
    elsif p_name is null or length(btrim(p_name))=0 then
        raise exception 'name_required' using errcode='PT400';
end if;

    foreach image in array array[p_profile_image_id,p_background_image_id] loop
        if image is not null and not pg_try_advisory_xact_lock(
            hashtextextended(
                list.owner_id::text||'/'||image::text||'.jpg',
                0
            )
        ) then
            raise exception 'photo_is_being_changed' using errcode='PT409';
end if;

        if image is not null and not exists (
            select 1
            from public.ranking_photo_uploads upload
            join storage.objects object
              on object.bucket_id='profile-photos'
             and object.name=upload.owner_id::text||'/'||upload.image_id::text||'.jpg'
            where upload.image_id=image
              and upload.owner_id=list.owner_id
              and upload.list_id=list.id
              and upload.uploader_id=auth.uid()
              and upload.expires_at>now()
              and object.owner_id=auth.uid()::text
            for update of upload
        ) then
            raise exception 'photo_not_ready' using errcode='PT400';
end if;
end loop;

    if target_id is null then
        insert into public.catalog_items(
            owner_id,name,description,profile_image_id,background_image_id
        )
        values(
            list.owner_id,
            coalesce(source.name,btrim(p_name)),
            coalesce(source.description,''),
            p_profile_image_id,
            p_background_image_id
        )
        returning id into target_id;
end if;

    if exists (
        select 1 from public.ranking_entries
        where list_id=p_list_id and position=p_position
    ) then
        if exists (
            select 1 from public.ranking_entries
            where list_id=p_list_id and position=9007199254740991
        ) then
            raise exception 'position_overflow' using errcode='PT400';
end if;

update public.ranking_entries
set position=position+1
where list_id=p_list_id and position>=p_position;
end if;

insert into public.ranking_entries(
    id,owner_id,list_id,item_id,position
)
values(
          p_entry_id,list.owner_id,p_list_id,target_id,p_position
      );

if source.id is not null then
        insert into public.ranking_catalog_sources
        values(target_id,auth.uid(),source.id)
        on conflict do nothing;
end if;

delete from public.ranking_photo_uploads
where image_id in (p_profile_image_id,p_background_image_id);

update public.ranking_lists
set revision=revision+1,updated_at=now()
where id=p_list_id;

return list.revision+1;
end;
$$;

revoke execute on function
    public.reserve_ranking_photo(uuid,integer),
    public.can_upload_ranking_photo(text),
    public.can_read_pending_ranking_photo(text),
    public.can_delete_profile_photo(text),
    public.cancel_ranking_photo(uuid),
    public.list_profile_photo_cleanup(),
    public.ack_profile_photo_cleanup(uuid,uuid),
    public.list_ranking_add_catalog(uuid),
    public.add_shared_ranking_entry(uuid,integer,uuid,bigint,text,uuid,integer,uuid,uuid)
    from PUBLIC,anon;

grant execute on function
public.reserve_ranking_photo(uuid,integer),
    public.can_upload_ranking_photo(text),
    public.can_read_pending_ranking_photo(text),
    public.can_delete_profile_photo(text),
    public.cancel_ranking_photo(uuid),
    public.list_profile_photo_cleanup(),
    public.ack_profile_photo_cleanup(uuid,uuid),
    public.list_ranking_add_catalog(uuid),
    public.add_shared_ranking_entry(uuid,integer,uuid,bigint,text,uuid,integer,uuid,uuid)
to authenticated;

commit;