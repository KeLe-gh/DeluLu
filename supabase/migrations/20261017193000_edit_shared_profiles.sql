begin;

create table public.shared_photo_cleanup (
                                             owner_id uuid not null references auth.users(id) on delete cascade,
                                             image_id uuid not null,
                                             requester_id uuid not null references auth.users(id) on delete cascade,
                                             list_id uuid not null references public.ranking_lists(id) on delete cascade,
                                             primary key(owner_id,image_id,requester_id,list_id)
);

alter table public.shared_photo_cleanup enable row level security;

revoke all on public.shared_photo_cleanup
    from PUBLIC,anon,authenticated;

create function public.can_cleanup_shared_photo(p_name text)
    returns boolean
    language sql stable security definer set search_path=''
as $$
select exists (
    select 1
    from public.shared_photo_cleanup cleanup
             join public.ranking_lists list
                  on list.id=cleanup.list_id
                      and list.owner_id=cleanup.owner_id
    where cleanup.requester_id=auth.uid()
      and p_name=cleanup.owner_id::text||'/'||cleanup.image_id::text||'.jpg'
        and (
                                                                  list.owner_id=auth.uid() or exists (
                                                                      select 1 from public.ranking_members
                                                                      where list_id=list.id and user_id=auth.uid()
                                                                  )
                                                                  )
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
$$;

create policy profile_photos_read_shared_cleanup
on storage.objects for select to authenticated
                                  using (
                                  bucket_id='profile-photos'
                                  and public.can_cleanup_shared_photo(name)
                                  );

create or replace function public.can_delete_profile_photo(p_name text)
returns boolean
language plpgsql volatile security definer set search_path=''
as $$
begin
    if auth.uid() is null or not (
        split_part(p_name,'/',1)=auth.uid()::text
        or public.can_cleanup_shared_photo(p_name)
        or exists (
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

create or replace function public.list_profile_photo_cleanup()
returns table(owner_id uuid,image_id uuid)
language sql stable security definer set search_path=''
as $$
select queue.owner_id,queue.image_id
from public.profile_photo_cleanup queue
where queue.owner_id=auth.uid()

union

select upload.owner_id,upload.image_id
from public.ranking_photo_uploads upload
where (upload.owner_id=auth.uid() or upload.uploader_id=auth.uid())
  and (upload.expires_at<=now() or upload.list_id is null)

union

select cleanup.owner_id,cleanup.image_id
from public.shared_photo_cleanup cleanup
where cleanup.requester_id=auth.uid()
  and public.can_cleanup_shared_photo(
        cleanup.owner_id::text||'/'||cleanup.image_id::text||'.jpg'
      )

    limit 50;
$$;

create or replace function public.ack_profile_photo_cleanup(
    p_owner_id uuid,
    p_image_id uuid
)
returns boolean
language plpgsql security definer set search_path=''
as $$
begin
    if auth.uid() is null
       or p_owner_id is null
       or p_image_id is null
    then
        return false;
end if;

    if p_owner_id<>auth.uid()
       and not public.can_cleanup_shared_photo(
           p_owner_id::text||'/'||p_image_id::text||'.jpg'
       )
       and not exists (
           select 1 from public.ranking_photo_uploads
           where owner_id=p_owner_id and image_id=p_image_id
             and uploader_id=auth.uid()
             and (expires_at<=now() or list_id is null)
       )
    then
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

delete from public.shared_photo_cleanup
where owner_id=p_owner_id and image_id=p_image_id;

return true;
end;
$$;

create function public.edit_shared_ranking_entry(
    p_list_id uuid,
    p_expected_revision integer,
    p_entry_id uuid,
    p_catalog_expected_revision integer,
    p_name text,
    p_position bigint,
    p_images jsonb default '{}'
)
    returns integer
    language plpgsql security definer set search_path=''
as $$
declare
list public.ranking_lists;
    entry public.ranking_entries;
    item public.catalog_items;
    profile uuid;
    background uuid;
    image uuid;
    old_image uuid;
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

    if p_expected_revision is null
       or list.revision<>p_expected_revision
    then
        raise exception 'ranking_revision_conflict' using errcode='PT409';
end if;

select * into entry
from public.ranking_entries
where id=p_entry_id
  and list_id=list.id
  and owner_id=list.owner_id;

if entry.id is null then
        raise exception 'entry_unavailable' using errcode='PT404';
end if;

begin
select * into item
from public.catalog_items
where id=entry.item_id and owner_id=list.owner_id
    for update nowait;
exception when lock_not_available then
        raise exception 'profile_is_being_changed' using errcode='PT409';
end;

    if item.id is null
       or p_catalog_expected_revision is null
       or item.revision<>p_catalog_expected_revision
    then
        raise exception 'catalog_revision_conflict' using errcode='PT409';
end if;

    if p_name is null
       or btrim(p_name)=''
       or p_position is null
       or p_position<1
       or p_position>9007199254740991
       or jsonb_typeof(p_images) is distinct from 'object'
    then
        raise exception 'invalid_profile_edit' using errcode='PT400';
end if;

    if (p_images-'profile_image_id'-'background_image_id')<>'{}'::jsonb
       or exists (
           select 1 from jsonb_each(p_images) field
           where jsonb_typeof(field.value) not in ('null','string')
              or (
                  jsonb_typeof(field.value)='string'
                  and (field.value#>>'{}') !~*
                  '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              )
       )
    then
        raise exception 'invalid_photo_changes' using errcode='PT400';
end if;

    profile:=case
        when p_images?'profile_image_id'
        then (p_images->>'profile_image_id')::uuid
        else item.profile_image_id
end;

    background:=case
        when p_images?'background_image_id'
        then (p_images->>'background_image_id')::uuid
        else item.background_image_id
end;

    foreach image in array array[
        case when profile is distinct from item.profile_image_id
            then profile end,
        case when background is distinct from item.background_image_id
            then background end
    ] loop
        if image is not null then
            if not pg_try_advisory_xact_lock(
                hashtextextended(
                    list.owner_id::text||'/'||image::text||'.jpg',
                    0
                )
            ) then
                raise exception 'photo_is_being_changed' using errcode='PT409';
end if;

            if not exists (
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
end if;
end loop;

    if exists (
        select 1 from public.ranking_entries
        where list_id=list.id
          and id<>entry.id
          and position=p_position
    ) then
        if exists (
            select 1 from public.ranking_entries
            where list_id=list.id
              and id<>entry.id
              and position=9007199254740991
        ) then
            raise exception 'position_overflow' using errcode='PT400';
end if;

update public.ranking_entries
set position=position+1
where list_id=list.id
  and id<>entry.id
  and position>=p_position;
end if;

update public.ranking_entries
set position=p_position
where id=entry.id;

if btrim(p_name) is distinct from item.name
       or profile is distinct from item.profile_image_id
       or background is distinct from item.background_image_id
    then
update public.catalog_items
set name=btrim(p_name),
    profile_image_id=profile,
    background_image_id=background,
    revision=revision+1,
    updated_at=now()
where id=item.id;

foreach old_image in array array[
            case when profile is distinct from item.profile_image_id
                then item.profile_image_id end,
            case when background is distinct from item.background_image_id
                then item.background_image_id end
        ] loop
            if old_image is not null then
                insert into public.shared_photo_cleanup
                values(list.owner_id,old_image,auth.uid(),list.id)
                on conflict do nothing;
end if;
end loop;
end if;

delete from public.ranking_photo_uploads
where image_id in (profile,background)
  and list_id=list.id
  and uploader_id=auth.uid();

update public.ranking_lists
set revision=revision+1,updated_at=now()
where id=list.id;

return list.revision+1;
end;
$$;

revoke execute on function
    public.can_cleanup_shared_photo(text),
    public.edit_shared_ranking_entry(uuid,integer,uuid,integer,text,bigint,jsonb)
    from PUBLIC,anon;

grant execute on function
public.can_cleanup_shared_photo(text),
    public.edit_shared_ranking_entry(uuid,integer,uuid,integer,text,bigint,jsonb)
to authenticated;

commit;