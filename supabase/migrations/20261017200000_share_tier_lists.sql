begin;

create table public.tier_share_links (
                                         list_id uuid primary key references public.tier_lists(id) on delete cascade,
                                         token text not null unique default (
                                             replace(gen_random_uuid()::text, '-', '') ||
                                             replace(gen_random_uuid()::text, '-', '')
                                             ) check (token ~ '^[0-9a-f]{64}$'),
    created_at timestamptz not null default now()
);

create table public.tier_members (
                                     list_id uuid not null references public.tier_lists(id) on delete cascade,
                                     user_id uuid not null references auth.users(id) on delete cascade,
                                     joined_at timestamptz not null default now(),
                                     primary key (list_id, user_id)
);

create index tier_members_user_list on public.tier_members(user_id, list_id);

alter table public.tier_share_links enable row level security;
alter table public.tier_members enable row level security;
revoke all on public.tier_share_links, public.tier_members
    from PUBLIC, anon, authenticated;

create function public.create_tier_share_link(
    p_list_id uuid, p_rotate boolean default false
)
    returns text language plpgsql security definer set search_path = ''
as $$
declare saved_token text;
begin
    if auth.uid() is null then
        raise exception 'authentication_required' using errcode = '42501';
end if;
    perform 1 from public.tier_lists
        where id = p_list_id and owner_id = auth.uid() for update;
if not found then
        raise exception 'tier_unavailable' using errcode = 'PT404';
end if;

insert into public.tier_share_links as link (list_id)
values (p_list_id)
on conflict (list_id) do update set
    token = case when coalesce(p_rotate, false) then excluded.token else link.token end,
                             created_at = case when coalesce(p_rotate, false) then now() else link.created_at end
    returning token into saved_token;
return saved_token;
end;
$$;

create function public.join_tier_share(p_token text)
    returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_list_id uuid; list_owner uuid;
begin
    if auth.uid() is null then
        raise exception 'authentication_required' using errcode = '42501';
end if;
select link.list_id into v_list_id from public.tier_share_links link where token = p_token;
if not found then
        raise exception 'share_unavailable' using errcode = 'PT404';
end if;
select list.owner_id into list_owner from public.tier_lists list
where list.id = v_list_id for update;
if not found or not exists (
        select 1 from public.tier_share_links link
        where link.list_id = v_list_id and token = p_token
    ) then
        raise exception 'share_unavailable' using errcode = 'PT404';
end if;

    if list_owner <> auth.uid() then
        insert into public.tier_members (list_id, user_id)
        values (v_list_id, auth.uid()) on conflict do nothing;
end if;
return v_list_id;
end;
$$;

create function public.list_shared_tiers()
    returns setof public.tier_lists
language sql stable security definer set search_path = ''
as $$
select list.* from public.tier_lists list
                       join public.tier_members member on member.list_id = list.id
where member.user_id = auth.uid()
order by list.created_at desc, list.id;
$$;

create function public.get_shared_tier(p_list_id uuid)
    returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare saved_list public.tier_lists;
begin
    if auth.uid() is null then
        raise exception 'authentication_required' using errcode = '42501';
end if;
select * into saved_list from public.tier_lists where id = p_list_id;
if not found or (
        saved_list.owner_id <> auth.uid() and not exists (
            select 1 from public.tier_members
            where list_id = p_list_id and user_id = auth.uid()
        )
    ) then
        raise exception 'tier_unavailable' using errcode = 'PT404';
end if;
return jsonb_build_object(
        'tier_list', to_jsonb(saved_list),
        'rows', coalesce((
                             select jsonb_agg(to_jsonb(row) order by row.position)
                             from public.tier_rows row where row.list_id = p_list_id
                         ), '[]'::jsonb),
        'entries', coalesce((
                                select jsonb_agg(to_jsonb(entry) order by entry.position, entry.id)
                                from public.tier_entries entry
                                where entry.list_id = p_list_id and entry.owner_id = saved_list.owner_id
                            ), '[]'::jsonb),
        'catalog_items', coalesce((
                                      select jsonb_agg(to_jsonb(item) order by item.name, item.id)
                                      from public.catalog_items item
                                      where item.owner_id = saved_list.owner_id and exists (
                                          select 1 from public.tier_entries entry
                                          where entry.list_id = p_list_id
                                            and entry.owner_id = item.owner_id
                                            and entry.item_id = item.id
                                      )
                                  ), '[]'::jsonb)
       );
end;
$$;

create function public.get_tier_members(p_list_id uuid)
    returns setof public.tier_members
language plpgsql stable security definer set search_path = ''
as $$
begin
    if auth.uid() is null then
        raise exception 'authentication_required' using errcode = '42501';
end if;
    if not exists (
        select 1 from public.tier_lists where id = p_list_id and owner_id = auth.uid()
    ) then
        raise exception 'tier_unavailable' using errcode = 'PT404';
end if;
return query select * from public.tier_members
        where list_id = p_list_id order by joined_at, user_id;
end;
$$;

create function public.leave_shared_tier(p_list_id uuid)
    returns boolean language plpgsql security definer set search_path = ''
as $$
declare list_owner uuid;
begin
    if auth.uid() is null then
        raise exception 'authentication_required' using errcode = '42501';
end if;
select owner_id into list_owner from public.tier_lists list
where list.id = p_list_id and (
    list.owner_id = auth.uid() or exists (
        select 1 from public.tier_members member
        where member.list_id = list.id and member.user_id = auth.uid()
    )
    ) for update;
if list_owner = auth.uid() then
        raise exception 'owner_cannot_leave' using errcode = 'PT400';
end if;
delete from public.tier_members where list_id = p_list_id and user_id = auth.uid();
return true;
end;
$$;

create function public.remove_tier_member(p_list_id uuid, p_user_id uuid)
    returns boolean language plpgsql security definer set search_path = ''
as $$
begin
    if auth.uid() is null then
        raise exception 'authentication_required' using errcode = '42501';
end if;
    perform 1 from public.tier_lists where id = p_list_id and owner_id = auth.uid() for update;
if not found then
        raise exception 'tier_unavailable' using errcode = 'PT404';
end if;
    if p_user_id is null or p_user_id = auth.uid() then
        raise exception 'invalid_member' using errcode = 'PT400';
end if;
delete from public.tier_members where list_id = p_list_id and user_id = p_user_id;
if found then
update public.tier_share_links set token = default, created_at = now() where list_id = p_list_id;
end if;
return true;
end;
$$;

create function public.stop_tier_sharing(p_list_id uuid)
    returns boolean language plpgsql security definer set search_path = ''
as $$
begin
    if auth.uid() is null then
        raise exception 'authentication_required' using errcode = '42501';
end if;
    perform 1 from public.tier_lists where id = p_list_id and owner_id = auth.uid() for update;
if not found then
        raise exception 'tier_unavailable' using errcode = 'PT404';
end if;
delete from public.tier_share_links where list_id = p_list_id;
delete from public.tier_members where list_id = p_list_id;
return true;
end;
$$;

create function public.can_read_tier_image(p_name text)
    returns boolean language sql stable security definer set search_path = ''
as $$
select exists (
    select 1 from public.tier_lists list
    where (
        list.owner_id = auth.uid() or exists (
            select 1 from public.tier_members member
            where member.list_id = list.id and member.user_id = auth.uid()
        )
        ) and exists (
        select 1 from public.tier_entries entry
                          join public.catalog_items item
                               on item.owner_id = entry.owner_id and item.id = entry.item_id
        where entry.list_id = list.id and entry.owner_id = list.owner_id and (
            p_name = item.owner_id::text || '/' || item.profile_image_id::text || '.jpg'
                or p_name = item.owner_id::text || '/' || item.background_image_id::text || '.jpg'
            )
    )
);
$$;

create policy profile_photos_read_shared_tier
on storage.objects for select to authenticated
                                  using (bucket_id = 'profile-photos' and public.can_read_tier_image(name));

revoke execute on function
    public.create_tier_share_link(uuid,boolean), public.join_tier_share(text),
    public.list_shared_tiers(), public.get_shared_tier(uuid), public.get_tier_members(uuid),
    public.leave_shared_tier(uuid), public.remove_tier_member(uuid,uuid),
    public.stop_tier_sharing(uuid), public.can_read_tier_image(text)
    from PUBLIC, anon;

grant execute on function
public.create_tier_share_link(uuid,boolean), public.join_tier_share(text),
    public.list_shared_tiers(), public.get_shared_tier(uuid), public.get_tier_members(uuid),
    public.leave_shared_tier(uuid), public.remove_tier_member(uuid,uuid),
    public.stop_tier_sharing(uuid), public.can_read_tier_image(text)
to authenticated;

alter table public.ranking_photo_uploads add column tier_list_id uuid
    references public.tier_lists(id) on delete set null;

alter table public.ranking_photo_uploads add constraint photo_upload_one_list
    check (list_id is null or tier_list_id is null);

create table public.tier_photo_cleanup (
                                           owner_id uuid not null references auth.users(id) on delete cascade,
                                           image_id uuid not null,
                                           requester_id uuid not null references auth.users(id) on delete cascade,
                                           list_id uuid not null references public.tier_lists(id) on delete cascade,
                                           primary key(owner_id,image_id,requester_id,list_id)
);

alter table public.tier_photo_cleanup enable row level security;
revoke all on public.tier_photo_cleanup from PUBLIC,anon,authenticated;

create or replace function public.can_upload_ranking_photo(p_name text)
returns boolean language sql stable security definer set search_path = ''
as $$
select exists (
    select 1 from public.ranking_photo_uploads upload
                      join public.ranking_lists list on list.id=upload.list_id and list.owner_id=upload.owner_id
    where upload.uploader_id=auth.uid() and upload.expires_at>now()
      and p_name=upload.owner_id::text||'/'||upload.image_id::text||'.jpg'
        and (list.owner_id=auth.uid() or exists (
            select 1 from public.ranking_members where list_id=list.id and user_id=auth.uid()
        ))
) or exists (
    select 1 from public.ranking_photo_uploads upload
                      join public.tier_lists list on list.id=upload.tier_list_id and list.owner_id=upload.owner_id
    where upload.uploader_id=auth.uid() and upload.expires_at>now()
      and p_name=upload.owner_id::text||'/'||upload.image_id::text||'.jpg'
        and (list.owner_id=auth.uid() or exists (
            select 1 from public.tier_members where list_id=list.id and user_id=auth.uid()
        ))
);
$$;

create or replace function public.can_cleanup_shared_photo(p_name text)
returns boolean language sql stable security definer set search_path=''
as $$
select (exists (
    select 1 from public.shared_photo_cleanup cleanup
                      join public.ranking_lists list on list.id=cleanup.list_id and list.owner_id=cleanup.owner_id
    where cleanup.requester_id=auth.uid()
      and p_name=cleanup.owner_id::text||'/'||cleanup.image_id::text||'.jpg'
        and (list.owner_id=auth.uid() or exists (
            select 1 from public.ranking_members where list_id=list.id and user_id=auth.uid()
        ))
) or exists (
    select 1 from public.tier_photo_cleanup cleanup
                      join public.tier_lists list on list.id=cleanup.list_id and list.owner_id=cleanup.owner_id
    where cleanup.requester_id=auth.uid()
      and p_name=cleanup.owner_id::text||'/'||cleanup.image_id::text||'.jpg'
        and (list.owner_id=auth.uid() or exists (
            select 1 from public.tier_members where list_id=list.id and user_id=auth.uid()
        ))
))
           and not exists (select 1 from public.catalog_items item where
        p_name=item.owner_id::text||'/'||item.profile_image_id::text||'.jpg'
        or p_name=item.owner_id::text||'/'||item.background_image_id::text||'.jpg')
           and not exists (select 1 from public.app_appearance appearance where
        p_name=appearance.owner_id::text||'/'||appearance.background_image_id::text||'.jpg')
           and not exists (select 1 from public.ranking_lists list where
        p_name=list.owner_id::text||'/'||list.cover_image_id::text||'.jpg'
        or p_name=list.owner_id::text||'/'||list.background_image_id::text||'.jpg');
$$;

create or replace function public.can_delete_profile_photo(p_name text)
returns boolean language plpgsql volatile security definer set search_path=''
as $$
begin
    if auth.uid() is null or not (
        split_part(p_name,'/',1)=auth.uid()::text
        or public.can_cleanup_shared_photo(p_name)
        or exists (select 1 from public.ranking_photo_uploads upload
            where upload.uploader_id=auth.uid()
              and (upload.expires_at<=now() or (upload.list_id is null and upload.tier_list_id is null))
              and p_name=upload.owner_id::text||'/'||upload.image_id::text||'.jpg')
    ) then return false; end if;

    if not pg_try_advisory_xact_lock(hashtextextended(p_name,0)) then return false; end if;

return not exists (select 1 from public.ranking_photo_uploads upload
                   where upload.expires_at>now() and (upload.list_id is not null or upload.tier_list_id is not null)
                     and p_name=upload.owner_id::text||'/'||upload.image_id::text||'.jpg')
    and not exists (select 1 from public.catalog_items item where
        p_name=item.owner_id::text||'/'||item.profile_image_id::text||'.jpg'
        or p_name=item.owner_id::text||'/'||item.background_image_id::text||'.jpg')
    and not exists (select 1 from public.app_appearance appearance where
        p_name=appearance.owner_id::text||'/'||appearance.background_image_id::text||'.jpg')
    and not exists (select 1 from public.ranking_lists list where
        p_name=list.owner_id::text||'/'||list.cover_image_id::text||'.jpg'
        or p_name=list.owner_id::text||'/'||list.background_image_id::text||'.jpg');
end;
$$;

create or replace function public.list_profile_photo_cleanup()
returns table(owner_id uuid,image_id uuid)
language sql stable security definer set search_path=''
as $$
select queue.owner_id,queue.image_id from public.profile_photo_cleanup queue where queue.owner_id=auth.uid()
union
select upload.owner_id,upload.image_id from public.ranking_photo_uploads upload
where (upload.owner_id=auth.uid() or upload.uploader_id=auth.uid())
  and (upload.expires_at<=now() or (upload.list_id is null and upload.tier_list_id is null))
union
select cleanup.owner_id,cleanup.image_id from public.shared_photo_cleanup cleanup
where cleanup.requester_id=auth.uid()
  and public.can_cleanup_shared_photo(cleanup.owner_id::text||'/'||cleanup.image_id::text||'.jpg')
union
select cleanup.owner_id,cleanup.image_id from public.tier_photo_cleanup cleanup
where cleanup.requester_id=auth.uid()
  and public.can_cleanup_shared_photo(cleanup.owner_id::text||'/'||cleanup.image_id::text||'.jpg')
    limit 50;
$$;

create or replace function public.ack_profile_photo_cleanup(p_owner_id uuid,p_image_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
    if auth.uid() is null or p_owner_id is null or p_image_id is null then return false; end if;

    if p_owner_id<>auth.uid()
       and not public.can_cleanup_shared_photo(p_owner_id::text||'/'||p_image_id::text||'.jpg')
       and not exists (
           select 1 from public.ranking_photo_uploads
           where owner_id=p_owner_id and image_id=p_image_id
             and uploader_id=auth.uid()
             and (expires_at<=now() or (list_id is null and tier_list_id is null))
       ) then return false; end if;

    if exists (
        select 1 from public.ranking_photo_uploads
        where owner_id=p_owner_id and image_id=p_image_id
          and expires_at>now() and (list_id is not null or tier_list_id is not null)
    ) then return false; end if;

    if exists (
        select 1 from storage.objects where bucket_id='profile-photos'
        and name=p_owner_id::text||'/'||p_image_id::text||'.jpg'
    ) then return false; end if;

delete from public.profile_photo_cleanup where owner_id=p_owner_id and image_id=p_image_id;
delete from public.ranking_photo_uploads where owner_id=p_owner_id and image_id=p_image_id;
delete from public.shared_photo_cleanup where owner_id=p_owner_id and image_id=p_image_id;
delete from public.tier_photo_cleanup where owner_id=p_owner_id and image_id=p_image_id;
return true;
end;
$$;

create function public.lock_shared_tier(p_list_id uuid,p_revision integer)
    returns public.tier_lists language plpgsql security definer set search_path=''
as $$
declare list public.tier_lists;
begin
    if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
begin
select * into list from public.tier_lists where id=p_list_id and (
    owner_id=auth.uid() or exists (
        select 1 from public.tier_members where list_id=p_list_id and user_id=auth.uid()
    )
    ) for update nowait;
exception when lock_not_available then raise exception 'tier_busy' using errcode='PT409'; end;

    if list.id is null or (list.owner_id<>auth.uid() and not exists (
        select 1 from public.tier_members where list_id=p_list_id and user_id=auth.uid()
    )) then raise exception 'tier_unavailable' using errcode='PT404'; end if;

    if p_revision is null or list.revision<>p_revision then
        raise exception 'tier_revision_conflict' using errcode='PT409';
end if;
return list;
end;
$$;

revoke all on function public.lock_shared_tier(uuid,integer) from PUBLIC,anon,authenticated;

create function public.reserve_tier_photo(p_list_id uuid,p_expected_revision integer)
    returns jsonb language plpgsql security definer set search_path=''
as $$
declare list public.tier_lists; photo public.ranking_photo_uploads;
begin
    list:=public.lock_shared_tier(p_list_id,p_expected_revision);
insert into public.ranking_photo_uploads(owner_id,uploader_id,tier_list_id)
values(list.owner_id,auth.uid(),list.id) returning * into photo;
return jsonb_build_object('owner_id',photo.owner_id,'image_id',photo.image_id);
end;
$$;

create function public.list_tier_add_catalog(p_list_id uuid)
    returns setof public.catalog_items language plpgsql stable security definer set search_path=''
as $$
begin
    if not exists (select 1 from public.tier_lists where id=p_list_id and (
        owner_id=auth.uid() or exists (
            select 1 from public.tier_members where list_id=p_list_id and user_id=auth.uid()
        )
    )) then raise exception 'tier_unavailable' using errcode='PT404'; end if;

return query select item.* from public.catalog_items item where item.owner_id=auth.uid()
    and not exists (select 1 from public.tier_entries where list_id=p_list_id and item_id=item.id)
    and not exists (
        select 1 from public.ranking_catalog_sources source
        join public.tier_entries entry on entry.item_id=source.item_id
        where entry.list_id=p_list_id
          and source.source_user_id=auth.uid()
          and source.source_item_id=item.id
    );
end;
$$;

create function public.add_shared_tier_entry(
    p_list_id uuid, p_expected_revision integer, p_entry_id uuid,
    p_name text default null, p_source_item_id uuid default null,
    p_source_expected_revision integer default null,
    p_profile_image_id uuid default null, p_background_image_id uuid default null
)
    returns integer language plpgsql security definer set search_path=''
as $$
declare list public.tier_lists; source public.catalog_items; target_id uuid; image uuid;
begin
    list:=public.lock_shared_tier(p_list_id,p_expected_revision);

    if p_entry_id is null then
        raise exception 'invalid_entry' using errcode='PT400';
end if;
    if exists(select 1 from public.tier_entries where id=p_entry_id) then
        raise exception 'entry_already_exists' using errcode='PT409';
end if;

    if p_source_item_id is not null then
begin
select * into source from public.catalog_items
where id=p_source_item_id and owner_id=auth.uid() for share nowait;
exception when lock_not_available then
            raise exception 'catalog_is_being_changed' using errcode='PT409';
end;

        if source.id is null or p_source_expected_revision is null
           or source.revision<>p_source_expected_revision then
            raise exception 'catalog_revision_conflict' using errcode='PT409';
end if;

        if exists (
            select 1 from public.ranking_catalog_sources origin
            join public.tier_entries entry on entry.item_id=origin.item_id
            where entry.list_id=p_list_id
              and origin.source_user_id=auth.uid()
              and origin.source_item_id=source.id
        ) or exists (
            select 1 from public.tier_entries where list_id=p_list_id and item_id=source.id
        ) then
            raise exception 'profile_already_added' using errcode='PT409';
end if;

        if source.owner_id=list.owner_id then
            if p_profile_image_id is not null or p_background_image_id is not null then
                raise exception 'unexpected_photo' using errcode='PT400';
end if;
            target_id:=source.id;
        elsif (source.profile_image_id is null)<>(p_profile_image_id is null)
           or (source.background_image_id is null)<>(p_background_image_id is null) then
            raise exception 'copied_photos_required' using errcode='PT400';
end if;
    elsif p_name is null or length(btrim(p_name))=0 then
        raise exception 'name_required' using errcode='PT400';
end if;

    foreach image in array array[p_profile_image_id,p_background_image_id] loop
        if image is not null and not pg_try_advisory_xact_lock(
            hashtextextended(list.owner_id::text||'/'||image::text||'.jpg',0)
        ) then raise exception 'photo_is_being_changed' using errcode='PT409'; end if;

        if image is not null and not exists (
            select 1 from public.ranking_photo_uploads upload
            join storage.objects object
              on object.bucket_id='profile-photos'
             and object.name=upload.owner_id::text||'/'||upload.image_id::text||'.jpg'
            where upload.image_id=image and upload.owner_id=list.owner_id
              and upload.tier_list_id=list.id and upload.uploader_id=auth.uid()
              and upload.expires_at>now() and object.owner_id=auth.uid()::text
            for update of upload
        ) then raise exception 'photo_not_ready' using errcode='PT400'; end if;
end loop;

    if target_id is null then
        insert into public.catalog_items(
            owner_id,name,description,profile_image_id,background_image_id
        )
        values(
            list.owner_id,coalesce(source.name,btrim(p_name)),
            coalesce(source.description,''),p_profile_image_id,p_background_image_id
        )
        returning id into target_id;
end if;

insert into public.tier_entries(id,owner_id,list_id,item_id,position)
select p_entry_id,list.owner_id,p_list_id,target_id,coalesce(max(position),0)+1
from public.tier_entries where list_id=p_list_id;

if source.id is not null then
        insert into public.ranking_catalog_sources
        values(target_id,auth.uid(),source.id) on conflict do nothing;
end if;

delete from public.ranking_photo_uploads
where image_id in (p_profile_image_id,p_background_image_id);

update public.tier_lists set revision=revision+1,updated_at=now() where id=p_list_id;
return list.revision+1;
end;
$$;

create function public.edit_shared_tier_entry(
    p_list_id uuid,p_expected_revision integer,p_entry_id uuid,
    p_catalog_expected_revision integer,p_name text,p_images jsonb default '{}'
)
    returns integer language plpgsql security definer set search_path=''
as $$
declare
list public.tier_lists; entry public.tier_entries; item public.catalog_items;
    profile uuid; background uuid; image uuid; old_image uuid;
begin
    list:=public.lock_shared_tier(p_list_id,p_expected_revision);

select * into entry from public.tier_entries
where id=p_entry_id and list_id=list.id and owner_id=list.owner_id;
if entry.id is null then raise exception 'entry_unavailable' using errcode='PT404'; end if;

begin
select * into item from public.catalog_items
where id=entry.item_id and owner_id=list.owner_id for update nowait;
exception when lock_not_available then
        raise exception 'profile_is_being_changed' using errcode='PT409';
end;

    if item.id is null or p_catalog_expected_revision is null
       or item.revision<>p_catalog_expected_revision then
        raise exception 'catalog_revision_conflict' using errcode='PT409';
end if;

    if p_name is null or btrim(p_name)=''
       or jsonb_typeof(p_images) is distinct from 'object' then
        raise exception 'invalid_profile_edit' using errcode='PT400';
end if;

    if (p_images-'profile_image_id'-'background_image_id')<>'{}'::jsonb or exists (
        select 1 from jsonb_each(p_images) field where
        jsonb_typeof(field.value) not in ('null','string') or (
            jsonb_typeof(field.value)='string' and (field.value#>>'{}') !~*
            '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        )
    ) then raise exception 'invalid_photo_changes' using errcode='PT400'; end if;

    profile:=case when p_images?'profile_image_id'
        then (p_images->>'profile_image_id')::uuid else item.profile_image_id end;
    background:=case when p_images?'background_image_id'
        then (p_images->>'background_image_id')::uuid else item.background_image_id end;

    foreach image in array array[
        case when profile is distinct from item.profile_image_id then profile end,
        case when background is distinct from item.background_image_id then background end
    ] loop
        if image is not null then
            if not pg_try_advisory_xact_lock(
                hashtextextended(list.owner_id::text||'/'||image::text||'.jpg',0)
            ) then raise exception 'photo_is_being_changed' using errcode='PT409'; end if;

            if not exists (
                select 1 from public.ranking_photo_uploads upload
                join storage.objects object
                  on object.bucket_id='profile-photos'
                 and object.name=upload.owner_id::text||'/'||upload.image_id::text||'.jpg'
                where upload.image_id=image and upload.owner_id=list.owner_id
                  and upload.tier_list_id=list.id and upload.uploader_id=auth.uid()
                  and upload.expires_at>now() and object.owner_id=auth.uid()::text
                for update of upload
            ) then raise exception 'photo_not_ready' using errcode='PT400'; end if;
end if;
end loop;

    if btrim(p_name) is distinct from item.name
       or profile is distinct from item.profile_image_id
       or background is distinct from item.background_image_id then

update public.catalog_items
set name=btrim(p_name),profile_image_id=profile,background_image_id=background,
    revision=revision+1,updated_at=now()
where id=item.id;

foreach old_image in array array[
            case when profile is distinct from item.profile_image_id then item.profile_image_id end,
            case when background is distinct from item.background_image_id then item.background_image_id end
        ] loop
            if old_image is not null then
                insert into public.tier_photo_cleanup
                values(list.owner_id,old_image,auth.uid(),list.id) on conflict do nothing;
end if;
end loop;
end if;

delete from public.ranking_photo_uploads
where image_id in (profile,background)
  and tier_list_id=list.id and uploader_id=auth.uid();

update public.tier_lists set revision=revision+1,updated_at=now() where id=list.id;
return list.revision+1;
end;
$$;

create function public.move_shared_tier_entry(
    p_list_id uuid,
    p_entry_id uuid,
    p_tier_id uuid,
    p_index integer,
    p_expected_revision integer
)
    returns integer language plpgsql security definer set search_path=''
as $$
declare
saved_list public.tier_lists;
    target_count integer;
    insertion_position numeric;
begin
    saved_list:=public.lock_shared_tier(p_list_id,p_expected_revision);

    if p_index is null or p_index<0 then
        raise exception 'invalid_position' using errcode='PT400';
end if;

    if not exists (
        select 1 from public.tier_entries
        where id=p_entry_id and list_id=p_list_id and owner_id=saved_list.owner_id
    ) then raise exception 'tier_entry_not_found' using errcode='PT404'; end if;

    if p_tier_id is not null and not exists (
        select 1 from public.tier_rows
        where id=p_tier_id and list_id=p_list_id and owner_id=saved_list.owner_id
    ) then raise exception 'tier_not_found' using errcode='PT404'; end if;

select count(*) into target_count from public.tier_entries
where owner_id=saved_list.owner_id and list_id=p_list_id and id<>p_entry_id
  and tier_id is not distinct from p_tier_id;

if p_index>target_count then
        raise exception 'invalid_tier_position' using errcode='PT400';
end if;

select position-0.5 into insertion_position from public.tier_entries
where owner_id=saved_list.owner_id and list_id=p_list_id and id<>p_entry_id
  and tier_id is not distinct from p_tier_id
order by position offset p_index limit 1;

if insertion_position is null then
select coalesce(max(position)+0.5, (
    select coalesce(max(position),0)+1 from public.tier_entries
    where owner_id=saved_list.owner_id and list_id=p_list_id
))
into insertion_position from public.tier_entries
where owner_id=saved_list.owner_id and list_id=p_list_id and id<>p_entry_id
  and tier_id is not distinct from p_tier_id;
end if;

with ordered as (
    select id,row_number() over (
            order by case when id=p_entry_id then insertion_position else position end
        )::integer as new_position
    from public.tier_entries
    where owner_id=saved_list.owner_id and list_id=p_list_id
)
update public.tier_entries as entry
set position=ordered.new_position,
    tier_id=case when entry.id=p_entry_id then p_tier_id else entry.tier_id end
    from ordered where entry.id=ordered.id;

update public.tier_lists
set revision=revision+1,updated_at=now()
where id=p_list_id and owner_id=saved_list.owner_id
    returning * into saved_list;

return saved_list.revision;
end;
$$;

create function public.remove_shared_tier_entry(
    p_list_id uuid,p_expected_revision integer,p_entry_id uuid
)
    returns integer language plpgsql security definer set search_path=''
as $$
declare list public.tier_lists;
begin
    list:=public.lock_shared_tier(p_list_id,p_expected_revision);

delete from public.tier_entries where list_id=list.id and id=p_entry_id;
if not found then raise exception 'entry_unavailable' using errcode='PT404'; end if;

with ordered as (
    select id,row_number() over(order by position)::integer position
from public.tier_entries where list_id=list.id
    )
update public.tier_entries entry set position=ordered.position
    from ordered where entry.id=ordered.id;

update public.tier_lists set revision=revision+1,updated_at=now() where id=list.id;
return list.revision+1;
end;
$$;

revoke execute on function
    public.reserve_tier_photo(uuid,integer),public.list_tier_add_catalog(uuid),
    public.add_shared_tier_entry(uuid,integer,uuid,text,uuid,integer,uuid,uuid),
    public.edit_shared_tier_entry(uuid,integer,uuid,integer,text,jsonb),
    public.move_shared_tier_entry(uuid,uuid,uuid,integer,integer),
    public.remove_shared_tier_entry(uuid,integer,uuid)
    from PUBLIC,anon;

grant execute on function
public.reserve_tier_photo(uuid,integer),public.list_tier_add_catalog(uuid),
    public.add_shared_tier_entry(uuid,integer,uuid,text,uuid,integer,uuid,uuid),
    public.edit_shared_tier_entry(uuid,integer,uuid,integer,text,jsonb),
    public.move_shared_tier_entry(uuid,uuid,uuid,integer,integer),
    public.remove_shared_tier_entry(uuid,integer,uuid)
to authenticated;

commit;