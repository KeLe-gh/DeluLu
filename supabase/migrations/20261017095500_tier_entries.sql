begin;

create table public.tier_entries (
                                     id uuid primary key,
                                     owner_id uuid not null default auth.uid(),
                                     list_id uuid not null,
                                     item_id uuid not null,
                                     tier_id uuid,
                                     position integer not null check (position >= 1),
                                     note text not null default '',

                                     foreign key (owner_id, list_id)
                                         references public.tier_lists(owner_id, id)
                                         on delete cascade,

                                     foreign key (owner_id, item_id)
                                         references public.catalog_items(owner_id, id)
                                         deferrable initially deferred,

                                     foreign key (owner_id, list_id, tier_id)
                                         references public.tier_rows(owner_id, list_id, id)
                                         deferrable initially deferred,

                                     unique (owner_id, list_id, item_id),

                                     unique (owner_id, list_id, position)
                                         deferrable initially deferred
);

alter table public.tier_entries enable row level security;

create policy tier_entries_owner_access
on public.tier_entries for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

revoke all on public.tier_entries
    from PUBLIC, anon, authenticated;

grant select, insert on public.tier_entries to authenticated;

grant update (revision, updated_at)
    on public.tier_lists to authenticated;

create function public.add_tier_entry(
    p_id uuid,
    p_list_id uuid,
    p_item_id uuid,
    p_expected_revision integer,
    p_new_name text default null,
    p_profile_image_id uuid default null
)
    returns jsonb
    language plpgsql
security invoker
set search_path = ''
as $$
declare
saved_list public.tier_lists;
    saved_item public.catalog_items;
    existing_entry public.tier_entries;
    next_position integer;
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

    if p_id is null
       or p_list_id is null
       or p_item_id is null
       or p_expected_revision is null
       or p_expected_revision < 0 then
        raise exception 'invalid_tier_entry'
            using errcode = 'PT400';
end if;

select *
into saved_list
from public.tier_lists
where id = p_list_id and owner_id = auth.uid()
    for update;

if not found then
        raise exception 'tier_list_not_found'
            using errcode = 'PT404';
end if;

select *
into existing_entry
from public.tier_entries
where id = p_id and owner_id = auth.uid();

if found then
        if existing_entry.list_id <> p_list_id
           or existing_entry.item_id <> p_item_id then
            raise exception 'tier_entry_conflict'
                using errcode = 'PT409';
end if;

select *
into strict saved_item
from public.catalog_items
where id = p_item_id and owner_id = auth.uid();

return jsonb_build_object(
        'tier_list', to_jsonb(saved_list),
        'catalog_item', to_jsonb(saved_item)
       );
end if;

    if saved_list.revision <> p_expected_revision then
        raise exception 'tier_revision_conflict'
            using errcode = 'PT409';
end if;

    if p_new_name is null then
        if p_profile_image_id is not null then
            raise exception 'unexpected_photo'
                using errcode = 'PT400';
end if;

select *
into saved_item
from public.catalog_items
where id = p_item_id and owner_id = auth.uid();

if not found then
            raise exception 'profile_not_found'
                using errcode = 'PT404';
end if;
else
        if char_length(btrim(p_new_name)) not between 1 and 120 then
            raise exception 'invalid_profile_name'
                using errcode = 'PT400';
end if;

select *
into strict saved_item
from public.save_catalog_item(
    p_id => p_item_id,
    p_name => p_new_name,
    p_profile_image_id => p_profile_image_id
    );
end if;

select coalesce(max(position), 0) + 1
into next_position
from public.tier_entries
where owner_id = auth.uid() and list_id = p_list_id;

insert into public.tier_entries (
    id, owner_id, list_id, item_id, tier_id, position
)
values (
           p_id, auth.uid(), p_list_id, p_item_id, null, next_position
       );

update public.tier_lists
set revision = revision + 1,
    updated_at = now()
where id = p_list_id and owner_id = auth.uid()
    returning * into saved_list;

return jsonb_build_object(
        'tier_list', to_jsonb(saved_list),
        'catalog_item', to_jsonb(saved_item)
       );
end;
$$;

revoke execute on function public.add_tier_entry(
    uuid, uuid, uuid, integer, text, uuid
    ) from PUBLIC, anon;

grant execute on function public.add_tier_entry(
    uuid, uuid, uuid, integer, text, uuid
) to authenticated;

commit;