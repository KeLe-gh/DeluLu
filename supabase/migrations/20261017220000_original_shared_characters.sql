begin;

-- Entries belong to their list; characters retain their own owner.
alter table public.ranking_entries
drop constraint ranking_entries_owner_id_item_id_fkey;

alter table public.ranking_entries
    add constraint ranking_entries_item_id_fkey
        foreign key(item_id)
            references public.catalog_items(id)
            on delete cascade;

alter table public.tier_entries
drop constraint tier_entries_owner_id_item_id_fkey;

alter table public.tier_entries
    add constraint tier_entries_item_id_fkey
        foreign key(item_id)
            references public.catalog_items(id)
            on delete cascade;

-- Character linking must go through the checked functions.
revoke insert, update, delete
    on public.ranking_entries, public.tier_entries
    from authenticated;

revoke update(tier_id, position)
    on public.tier_entries
    from authenticated;

-- These older functions explicitly check the signed-in owner.
alter function public.add_tier_entry(
    uuid, uuid, uuid, integer, text, uuid
    ) security definer;

alter function public.move_tier_entry(
    uuid, uuid, uuid, integer, integer
    ) security definer;


create function public.lock_shared_ranking(
    p_list_id uuid,
    p_revision integer
)
    returns public.ranking_lists
language plpgsql security definer
set search_path = ''
as $$
declare
list public.ranking_lists;
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

begin
select * into list
from public.ranking_lists
where id = p_list_id
  and (
    owner_id = auth.uid()
        or exists (
        select 1 from public.ranking_members
        where list_id = p_list_id
          and user_id = auth.uid()
    )
    )
    for update nowait;
exception when lock_not_available then
        raise exception 'ranking_busy'
            using errcode = 'PT409';
end;

    if list.id is null or (
        list.owner_id <> auth.uid()
        and not exists (
            select 1 from public.ranking_members
            where list_id = p_list_id
              and user_id = auth.uid()
        )
    ) then
        raise exception 'ranking_unavailable'
            using errcode = 'PT404';
end if;

    if p_revision is null or list.revision <> p_revision then
        raise exception 'ranking_revision_conflict'
            using errcode = 'PT409';
end if;

return list;
end;
$$;

revoke all on function public.lock_shared_ranking(uuid, integer)
    from PUBLIC, anon, authenticated;


create or replace function public.get_shared_ranking(p_list_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
saved_list public.ranking_lists;
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

select * into saved_list
from public.ranking_lists
where id = p_list_id;

if not found or (
        saved_list.owner_id <> auth.uid()
        and not exists (
            select 1 from public.ranking_members
            where list_id = p_list_id
              and user_id = auth.uid()
        )
    ) then
        raise exception 'ranking_unavailable'
            using errcode = 'PT404';
end if;

return jsonb_build_object(
        'ranking_list', to_jsonb(saved_list),
        'entries', coalesce((
                                select jsonb_agg(to_jsonb(entry) order by entry.position, entry.id)
                                from public.ranking_entries entry
                                where entry.list_id = p_list_id
                                  and entry.owner_id = saved_list.owner_id
                            ), '[]'::jsonb),
        'catalog_items', coalesce((
                                      select jsonb_agg(to_jsonb(item) order by item.name, item.id)
                                      from public.catalog_items item
                                      where exists (
                                          select 1 from public.ranking_entries entry
                                          where entry.list_id = p_list_id
                                            and entry.item_id = item.id
                                      )
                                  ), '[]'::jsonb)
       );
end;
$$;


create or replace function public.get_shared_tier(p_list_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
saved_list public.tier_lists;
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

select * into saved_list
from public.tier_lists
where id = p_list_id;

if not found or (
        saved_list.owner_id <> auth.uid()
        and not exists (
            select 1 from public.tier_members
            where list_id = p_list_id
              and user_id = auth.uid()
        )
    ) then
        raise exception 'tier_unavailable'
            using errcode = 'PT404';
end if;

return jsonb_build_object(
        'tier_list', to_jsonb(saved_list),
        'rows', coalesce((
                             select jsonb_agg(to_jsonb(row) order by row.position)
                             from public.tier_rows row
                             where row.list_id = p_list_id
                         ), '[]'::jsonb),
        'entries', coalesce((
                                select jsonb_agg(to_jsonb(entry) order by entry.position, entry.id)
                                from public.tier_entries entry
                                where entry.list_id = p_list_id
                                  and entry.owner_id = saved_list.owner_id
                            ), '[]'::jsonb),
        'catalog_items', coalesce((
                                      select jsonb_agg(to_jsonb(item) order by item.name, item.id)
                                      from public.catalog_items item
                                      where exists (
                                          select 1 from public.tier_entries entry
                                          where entry.list_id = p_list_id
                                            and entry.item_id = item.id
                                      )
                                  ), '[]'::jsonb)
       );
end;
$$;


create or replace function public.can_read_ranking_image(p_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
select exists (
    select 1 from public.ranking_lists list
    where (
        list.owner_id = auth.uid()
            or exists (
            select 1 from public.ranking_members member
            where member.list_id = list.id
              and member.user_id = auth.uid()
        )
        )
      and (
        p_name = list.owner_id::text || '/' || list.cover_image_id::text || '.jpg'
            or p_name = list.owner_id::text || '/' || list.background_image_id::text || '.jpg'
            or exists (
                select 1 from public.ranking_entries entry
                join public.catalog_items item on item.id = entry.item_id
                where entry.list_id = list.id
                  and entry.owner_id = list.owner_id
                  and (
                      p_name = item.owner_id::text || '/' || item.profile_image_id::text || '.jpg'
                      or p_name = item.owner_id::text || '/' || item.background_image_id::text || '.jpg'
                  )
            )
        )
);
$$;


create or replace function public.can_read_tier_image(p_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
select exists (
    select 1 from public.tier_lists list
    where (
        list.owner_id = auth.uid()
            or exists (
            select 1 from public.tier_members member
            where member.list_id = list.id
              and member.user_id = auth.uid()
        )
        )
      and exists (
        select 1 from public.tier_entries entry
                          join public.catalog_items item on item.id = entry.item_id
        where entry.list_id = list.id
          and entry.owner_id = list.owner_id
          and (
            p_name = item.owner_id::text || '/' || item.profile_image_id::text || '.jpg'
                  or p_name = item.owner_id::text || '/' || item.background_image_id::text || '.jpg'
            )
    )
);
$$;


create or replace function public.reserve_ranking_photo(
    p_list_id uuid,
    p_expected_revision integer
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
list public.ranking_lists;
    photo public.ranking_photo_uploads;
begin
    list := public.lock_shared_ranking(p_list_id, p_expected_revision);

insert into public.ranking_photo_uploads(owner_id, uploader_id, list_id)
values(auth.uid(), auth.uid(), list.id)
    returning * into photo;

return jsonb_build_object(
        'owner_id', photo.owner_id,
        'image_id', photo.image_id
       );
end;
$$;


create or replace function public.reserve_tier_photo(
    p_list_id uuid,
    p_expected_revision integer
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
list public.tier_lists;
    photo public.ranking_photo_uploads;
begin
    list := public.lock_shared_tier(p_list_id, p_expected_revision);

insert into public.ranking_photo_uploads(owner_id, uploader_id, tier_list_id)
values(auth.uid(), auth.uid(), list.id)
    returning * into photo;

return jsonb_build_object(
        'owner_id', photo.owner_id,
        'image_id', photo.image_id
       );
end;
$$;


-- Expire unfinished uploads made under the previous ownership model.
-- Photos already referenced by profiles remain protected.
update public.ranking_photo_uploads
set expires_at = now()
where owner_id is distinct from uploader_id;


create or replace function public.can_upload_ranking_photo(p_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
select exists (
    select 1 from public.ranking_photo_uploads upload
    where upload.owner_id = auth.uid()
      and upload.uploader_id = auth.uid()
      and upload.expires_at > now()
      and p_name = upload.owner_id::text || '/' || upload.image_id::text || '.jpg'
);
$$;


create function public.check_original_photo(
    p_kind text,
    p_list_id uuid,
    p_image_id uuid
)
    returns void
    language plpgsql security definer
set search_path = ''
as $$
begin
    if p_image_id is null then return; end if;

    if not pg_try_advisory_xact_lock(
        hashtextextended(auth.uid()::text || '/' || p_image_id::text || '.jpg', 0)
    ) then
        raise exception 'photo_busy'
            using errcode = 'PT409';
end if;

    if not exists (
        select 1
        from public.ranking_photo_uploads upload
        join storage.objects object
          on object.bucket_id = 'profile-photos'
         and object.name = upload.owner_id::text || '/' || upload.image_id::text || '.jpg'
        where upload.image_id = p_image_id
          and upload.owner_id = auth.uid()
          and upload.uploader_id = auth.uid()
          and upload.expires_at > now()
          and object.owner_id = auth.uid()::text
          and (
              (p_kind = 'ranking' and upload.list_id = p_list_id)
              or (p_kind = 'tier' and upload.tier_list_id = p_list_id)
          )
        for update of upload
    ) then
        raise exception 'photo_not_ready'
            using errcode = 'PT400';
end if;

delete from public.ranking_photo_uploads
where image_id = p_image_id;
end;
$$;

revoke all on function public.check_original_photo(text, uuid, uuid)
    from PUBLIC, anon, authenticated;


create function public.original_character_for_entry(
    p_kind text,
    p_list_id uuid,
    p_source_item_id uuid,
    p_source_expected_revision integer,
    p_name text,
    p_profile_image_id uuid,
    p_background_image_id uuid
)
    returns uuid
    language plpgsql security definer
set search_path = ''
as $$
declare
item public.catalog_items;
begin
    if p_source_item_id is not null then
        if p_profile_image_id is not null or p_background_image_id is not null then
            raise exception 'unexpected_photo'
                using errcode = 'PT400';
end if;

begin
select * into item
from public.catalog_items
where id = p_source_item_id
  and owner_id = auth.uid()
    for share nowait;
exception when lock_not_available then
            raise exception 'catalog_busy'
                using errcode = 'PT409';
end;

        if item.id is null
           or p_source_expected_revision is null
           or item.revision <> p_source_expected_revision then
            raise exception 'catalog_revision_conflict'
                using errcode = 'PT409';
end if;

return item.id;
end if;

    if p_name is null or length(btrim(p_name)) not between 1 and 120 then
        raise exception 'invalid_name'
            using errcode = 'PT400';
end if;

    perform public.check_original_photo(p_kind, p_list_id, p_profile_image_id);

    if p_background_image_id is distinct from p_profile_image_id then
        perform public.check_original_photo(p_kind, p_list_id, p_background_image_id);
end if;

insert into public.catalog_items(
    owner_id, name, profile_image_id, background_image_id
)
values(
          auth.uid(), btrim(p_name), p_profile_image_id, p_background_image_id
      )
    returning * into item;

return item.id;
end;
$$;

revoke all on function public.original_character_for_entry(
    text, uuid, uuid, integer, text, uuid, uuid
    ) from PUBLIC, anon, authenticated;


create or replace function public.list_ranking_add_catalog(p_list_id uuid)
returns setof public.catalog_items
language plpgsql stable security definer
set search_path = ''
as $$
begin
    if not exists (
        select 1 from public.ranking_lists
        where id = p_list_id
          and (
              owner_id = auth.uid()
              or exists (
                  select 1 from public.ranking_members
                  where list_id = p_list_id
                    and user_id = auth.uid()
              )
          )
    ) then
        raise exception 'list_unavailable'
            using errcode = 'PT404';
end if;

return query
select item.* from public.catalog_items item
where item.owner_id = auth.uid()
  and not exists (
    select 1 from public.ranking_entries
    where list_id = p_list_id and item_id = item.id
)
  and not exists (
    select 1 from public.ranking_catalog_sources source
                      join public.ranking_entries entry on entry.item_id = source.item_id
    where entry.list_id = p_list_id
      and source.source_user_id = auth.uid()
      and source.source_item_id = item.id
);
end;
$$;


create or replace function public.add_shared_ranking_entry(
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
language plpgsql security definer
set search_path = ''
as $$
declare
list public.ranking_lists;
    target_id uuid;
begin
    list := public.lock_shared_ranking(p_list_id, p_expected_revision);

    if p_entry_id is null or p_position is null
       or p_position < 1 or p_position > 9007199254740991 then
        raise exception 'invalid_entry'
            using errcode = 'PT400';
end if;

    if exists (
        select 1 from public.ranking_entries where id = p_entry_id
    ) then
        raise exception 'entry_already_exists'
            using errcode = 'PT409';
end if;

    target_id := public.original_character_for_entry(
        'ranking', p_list_id, p_source_item_id, p_source_expected_revision,
        p_name, p_profile_image_id, p_background_image_id
    );

    if exists (
        select 1 from public.ranking_entries
        where list_id = p_list_id and item_id = target_id
    ) or exists (
        select 1 from public.ranking_catalog_sources origin
        join public.ranking_entries entry on entry.item_id = origin.item_id
        where entry.list_id = p_list_id
          and origin.source_user_id = auth.uid()
          and origin.source_item_id = target_id
    ) then
        raise exception 'profile_already_added'
            using errcode = 'PT409';
end if;

    if exists (
        select 1 from public.ranking_entries
        where list_id = p_list_id and position = p_position
    ) then
        if exists (
            select 1 from public.ranking_entries
            where list_id = p_list_id and position = 9007199254740991
        ) then
            raise exception 'position_overflow'
                using errcode = 'PT400';
end if;

update public.ranking_entries
set position = position + 1
where list_id = p_list_id and position >= p_position;
end if;

insert into public.ranking_entries(
    id, owner_id, list_id, item_id, position
)
values(
          p_entry_id, list.owner_id, p_list_id, target_id, p_position
      );

update public.ranking_lists
set revision = revision + 1, updated_at = now()
where id = p_list_id;

return list.revision + 1;
end;
$$;


create or replace function public.list_tier_add_catalog(p_list_id uuid)
returns setof public.catalog_items
language plpgsql stable security definer
set search_path = ''
as $$
begin
    if not exists (
        select 1 from public.tier_lists
        where id = p_list_id
          and (
              owner_id = auth.uid()
              or exists (
                  select 1 from public.tier_members
                  where list_id = p_list_id and user_id = auth.uid()
              )
          )
    ) then
        raise exception 'list_unavailable'
            using errcode = 'PT404';
end if;

return query
select item.* from public.catalog_items item
where item.owner_id = auth.uid()
  and not exists (
    select 1 from public.tier_entries
    where list_id = p_list_id and item_id = item.id
)
  and not exists (
    select 1 from public.ranking_catalog_sources source
                      join public.tier_entries entry on entry.item_id = source.item_id
    where entry.list_id = p_list_id
      and source.source_user_id = auth.uid()
      and source.source_item_id = item.id
);
end;
$$;


create or replace function public.add_shared_tier_entry(
    p_list_id uuid,
    p_expected_revision integer,
    p_entry_id uuid,
    p_name text default null,
    p_source_item_id uuid default null,
    p_source_expected_revision integer default null,
    p_profile_image_id uuid default null,
    p_background_image_id uuid default null
)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
list public.tier_lists;
    target_id uuid;
begin
    list := public.lock_shared_tier(p_list_id, p_expected_revision);

    if p_entry_id is null then
        raise exception 'invalid_entry' using errcode = 'PT400';
end if;

    if exists (
        select 1 from public.tier_entries where id = p_entry_id
    ) then
        raise exception 'entry_already_exists' using errcode = 'PT409';
end if;

    target_id := public.original_character_for_entry(
        'tier', p_list_id, p_source_item_id, p_source_expected_revision,
        p_name, p_profile_image_id, p_background_image_id
    );

    if exists (
        select 1 from public.tier_entries
        where list_id = p_list_id and item_id = target_id
    ) or exists (
        select 1 from public.ranking_catalog_sources origin
        join public.tier_entries entry on entry.item_id = origin.item_id
        where entry.list_id = p_list_id
          and origin.source_user_id = auth.uid()
          and origin.source_item_id = target_id
    ) then
        raise exception 'profile_already_added' using errcode = 'PT409';
end if;

insert into public.tier_entries(
    id, owner_id, list_id, item_id, position
)
select
    p_entry_id, list.owner_id, p_list_id, target_id,
    coalesce(max(position), 0) + 1
from public.tier_entries
where list_id = p_list_id;

update public.tier_lists
set revision = revision + 1, updated_at = now()
where id = p_list_id;

return list.revision + 1;
end;
$$;


create function public.edit_original_character(
    p_kind text,
    p_list_id uuid,
    p_item_id uuid,
    p_catalog_expected_revision integer,
    p_name text,
    p_images jsonb
)
    returns void
    language plpgsql security definer
set search_path = ''
as $$
declare
item public.catalog_items;
    profile uuid;
    background uuid;
begin
begin
select * into item
from public.catalog_items
where id = p_item_id and owner_id = auth.uid()
    for update nowait;
exception when lock_not_available then
        raise exception 'catalog_busy' using errcode = 'PT409';
end;

    if item.id is null then
        raise exception 'character_owner_required'
            using errcode = '42501';
end if;

    if p_catalog_expected_revision is null
       or item.revision <> p_catalog_expected_revision then
        raise exception 'catalog_revision_conflict'
            using errcode = 'PT409';
end if;

    if p_name is null
       or length(btrim(p_name)) not between 1 and 120
       or jsonb_typeof(p_images) is distinct from 'object' then
        raise exception 'invalid_profile_edit'
            using errcode = 'PT400';
end if;

    if (p_images - 'profile_image_id' - 'background_image_id') <> '{}'::jsonb
       or exists (
           select 1 from jsonb_each(p_images) field
           where jsonb_typeof(field.value) not in ('null', 'string')
              or (
                  jsonb_typeof(field.value) = 'string'
                  and (field.value #>> '{}') !~*
                  '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              )
       ) then
        raise exception 'invalid_photo_changes'
            using errcode = 'PT400';
end if;

    profile := case
        when p_images ? 'profile_image_id'
        then (p_images ->> 'profile_image_id')::uuid
        else item.profile_image_id
end;

    background := case
        when p_images ? 'background_image_id'
        then (p_images ->> 'background_image_id')::uuid
        else item.background_image_id
end;

    if profile is distinct from item.profile_image_id then
        perform public.check_original_photo(p_kind, p_list_id, profile);
end if;

    if background is distinct from item.background_image_id
       and background is distinct from profile then
        perform public.check_original_photo(p_kind, p_list_id, background);
end if;

    if btrim(p_name) is distinct from item.name
       or profile is distinct from item.profile_image_id
       or background is distinct from item.background_image_id then
update public.catalog_items
set name = btrim(p_name),
    profile_image_id = profile,
    background_image_id = background,
    revision = revision + 1,
    updated_at = now()
where id = item.id;
end if;
end;
$$;

revoke all on function public.edit_original_character(
    text, uuid, uuid, integer, text, jsonb
    ) from PUBLIC, anon, authenticated;


create or replace function public.edit_shared_ranking_entry(
    p_list_id uuid,
    p_expected_revision integer,
    p_entry_id uuid,
    p_catalog_expected_revision integer,
    p_name text,
    p_position bigint,
    p_images jsonb default '{}'
)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
list public.ranking_lists;
    entry public.ranking_entries;
begin
    list := public.lock_shared_ranking(p_list_id, p_expected_revision);

select * into entry
from public.ranking_entries
where id = p_entry_id
  and list_id = list.id
  and owner_id = list.owner_id;

if entry.id is null then
        raise exception 'entry_unavailable' using errcode = 'PT404';
end if;

    perform public.edit_original_character(
        'ranking', list.id, entry.item_id,
        p_catalog_expected_revision, p_name, p_images
    );

    if p_position is null or p_position < 1
       or p_position > 9007199254740991 then
        raise exception 'invalid_position' using errcode = 'PT400';
end if;

    if exists (
        select 1 from public.ranking_entries
        where list_id = list.id and id <> entry.id and position = p_position
    ) then
        if exists (
            select 1 from public.ranking_entries
            where list_id = list.id
              and id <> entry.id
              and position = 9007199254740991
        ) then
            raise exception 'position_overflow' using errcode = 'PT400';
end if;

update public.ranking_entries
set position = position + 1
where list_id = list.id and id <> entry.id and position >= p_position;
end if;

update public.ranking_entries
set position = p_position
where id = entry.id;

update public.ranking_lists
set revision = revision + 1, updated_at = now()
where id = list.id;

return list.revision + 1;
end;
$$;


create or replace function public.edit_shared_tier_entry(
    p_list_id uuid,
    p_expected_revision integer,
    p_entry_id uuid,
    p_catalog_expected_revision integer,
    p_name text,
    p_images jsonb default '{}'
)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
list public.tier_lists;
    entry public.tier_entries;
begin
    list := public.lock_shared_tier(p_list_id, p_expected_revision);

select * into entry
from public.tier_entries
where id = p_entry_id
  and list_id = list.id
  and owner_id = list.owner_id;

if entry.id is null then
        raise exception 'entry_unavailable' using errcode = 'PT404';
end if;

    perform public.edit_original_character(
        'tier', list.id, entry.item_id,
        p_catalog_expected_revision, p_name, p_images
    );

update public.tier_lists
set revision = revision + 1, updated_at = now()
where id = list.id;

return list.revision + 1;
end;
$$;


-- Owner overview saves must preserve existing foreign references
-- without allowing arbitrary foreign characters to be attached.
create or replace function public.save_ranking_list(
    p_list jsonb,
    p_entries jsonb,
    p_expected_revision integer default null
)
returns setof public.ranking_lists
language plpgsql security definer
set search_path = ''
as $$
declare
v_owner_id uuid := auth.uid();
    v_list_id uuid;
    v_saved_list public.ranking_lists;
begin
    if v_owner_id is null then
        raise exception 'authentication_required' using errcode = '42501';
end if;

    if jsonb_typeof(p_list) is distinct from 'object'
       or jsonb_typeof(p_entries) is distinct from 'array' then
        raise exception 'invalid_ranking_payload' using errcode = 'PT400';
end if;

    if p_expected_revision < 0 then
        raise exception 'invalid_expected_revision' using errcode = 'PT400';
end if;

    v_list_id := (p_list ->> 'id')::uuid;

    if v_list_id is null then
        raise exception 'ranking_id_required' using errcode = 'PT400';
end if;

    if p_expected_revision is null then
        insert into public.ranking_lists(
            id, owner_id, title, description, cover_image_id,
            theme_id, accent_color, background_image_id
        )
        values(
            v_list_id, v_owner_id, btrim(p_list ->> 'title'),
            coalesce(p_list ->> 'description', ''),
            (p_list ->> 'cover_image_id')::uuid,
            coalesce(p_list ->> 'theme_id', 'default'),
            p_list ->> 'accent_color',
            (p_list ->> 'background_image_id')::uuid
        )
        returning * into v_saved_list;
else
update public.ranking_lists list
set title = btrim(p_list ->> 'title'),
    description = coalesce(p_list ->> 'description', ''),
    cover_image_id = (p_list ->> 'cover_image_id')::uuid,
            theme_id = coalesce(p_list ->> 'theme_id', 'default'),
            accent_color = p_list ->> 'accent_color',
            background_image_id = (p_list ->> 'background_image_id')::uuid,
            updated_at = now(),
            revision = list.revision + 1
where list.id = v_list_id
  and list.owner_id = v_owner_id
  and list.revision = p_expected_revision
    returning list.* into v_saved_list;

if not found then
            raise exception 'ranking_revision_conflict' using errcode = 'PT409';
end if;
end if;

    if exists (
        select 1
        from jsonb_to_recordset(p_entries) entry(id uuid, item_id uuid)
        left join public.catalog_items item on item.id = entry.item_id
        where item.id is null
           or (
               item.owner_id <> v_owner_id
               and not exists (
                   select 1 from public.ranking_entries existing
                   where existing.list_id = v_list_id
                     and existing.id = entry.id
                     and existing.item_id = entry.item_id
               )
           )
           or exists (
               select 1 from public.ranking_entries other
               where other.id = entry.id and other.list_id <> v_list_id
           )
    ) then
        raise exception 'character_access_denied' using errcode = '42501';
end if;

delete from public.ranking_entries
where list_id = v_list_id and owner_id = v_owner_id;

insert into public.ranking_entries(
    id, owner_id, list_id, item_id, position, note
)
select
    entry.id, v_owner_id, v_list_id, entry.item_id,
    entry.position, coalesce(entry.note, '')
from jsonb_to_recordset(p_entries) entry(
                                         id uuid, item_id uuid, position bigint, note text
    );

return next v_saved_list;
return;
end;
$$;


-- Deleting an original removes placements across all accounts.
create function public.remove_original_character_entries()
    returns trigger
    language plpgsql security definer
set search_path = ''
as $$
declare
ranking_ids uuid[];
    tier_ids uuid[];
begin
    ranking_ids := array(
        select distinct list_id from public.ranking_entries
        where item_id = old.id
    );

    tier_ids := array(
        select distinct list_id from public.tier_entries
        where item_id = old.id
    );

begin
        perform id from public.ranking_lists
        where id = any(ranking_ids)
        order by id for update nowait;

perform id from public.tier_lists
        where id = any(tier_ids)
        order by id for update nowait;
exception when lock_not_available then
        raise exception 'list_busy' using errcode = 'PT409';
end;

delete from public.ranking_entries where item_id = old.id;
delete from public.tier_entries where item_id = old.id;

update public.ranking_lists
set revision = revision + 1, updated_at = now()
where id = any(ranking_ids);

update public.tier_lists
set revision = revision + 1, updated_at = now()
where id = any(tier_ids);

return old;
end;
$$;

revoke all on function public.remove_original_character_entries()
    from PUBLIC, anon, authenticated;

create trigger catalog_items_remove_original_entries
    before delete on public.catalog_items
    for each row execute function public.remove_original_character_entries();


create or replace function public.delete_catalog_item(
    p_id uuid,
    p_expected_revision integer
)
returns boolean
language plpgsql security invoker
set search_path = ''
as $$
declare
item public.catalog_items;
begin
    if auth.uid() is null then
        raise exception 'authentication_required' using errcode = '42501';
end if;

    if p_id is null or p_expected_revision is null
       or p_expected_revision < 0 then
        raise exception 'invalid_catalog_deletion' using errcode = 'PT400';
end if;

select * into item
from public.catalog_items
where id = p_id and owner_id = auth.uid()
    for update;

if item.id is null then return true; end if;

    if item.revision <> p_expected_revision then
        raise exception 'catalog_revision_conflict' using errcode = 'PT409';
end if;

delete from public.catalog_items
where id = item.id and owner_id = auth.uid();

return true;
end;
$$;

commit;