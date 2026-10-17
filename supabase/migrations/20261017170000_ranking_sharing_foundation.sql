begin;

create table public.ranking_share_links (
                                            list_id uuid primary key
                                                references public.ranking_lists(id) on delete cascade,
                                            token text not null unique default (
                                                replace(gen_random_uuid()::text, '-', '') ||
                                                replace(gen_random_uuid()::text, '-', '')
                                                ) check (token ~ '^[0-9a-f]{64}$'),
    created_at timestamptz not null default now()
);

create table public.ranking_members (
                                        list_id uuid not null
                                            references public.ranking_lists(id) on delete cascade,
                                        user_id uuid not null
                                            references auth.users(id) on delete cascade,
                                        joined_at timestamptz not null default now(),
                                        primary key (list_id, user_id)
);

create index ranking_members_user_list
    on public.ranking_members(user_id, list_id);

alter table public.ranking_share_links enable row level security;
alter table public.ranking_members enable row level security;

revoke all on public.ranking_share_links, public.ranking_members
    from PUBLIC, anon, authenticated;

create function public.create_ranking_share_link(
    p_list_id uuid,
    p_rotate boolean default false
)
    returns text
    language plpgsql
security definer
set search_path = ''
as $$
declare
saved_token text;
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

    perform 1
    from public.ranking_lists
    where id = p_list_id and owner_id = auth.uid()
    for update;

if not found then
        raise exception 'ranking_unavailable'
            using errcode = 'PT404';
end if;

insert into public.ranking_share_links as link (list_id)
values (p_list_id)
on conflict (list_id) do update set
    token = case
                             when coalesce(p_rotate, false) then excluded.token
                             else link.token
end,
        created_at = case
            when coalesce(p_rotate, false) then now()
            else link.created_at
end
    returning token into saved_token;

return saved_token;
end;
$$;

create function public.join_ranking_share(p_token text)
    returns uuid
    language plpgsql
security definer
set search_path = ''
as $$
declare
v_list_id uuid;
    list_owner uuid;
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

select link.list_id
into v_list_id
from public.ranking_share_links link
where token = p_token;

if not found then
        raise exception 'share_unavailable'
            using errcode = 'PT404';
end if;

select list.owner_id
into list_owner
from public.ranking_lists list
where list.id = v_list_id
    for update;

if not found or not exists (
        select 1
        from public.ranking_share_links link
        where link.list_id = v_list_id and token = p_token
    ) then
        raise exception 'share_unavailable'
            using errcode = 'PT404';
end if;

    if list_owner <> auth.uid() then
        insert into public.ranking_members (list_id, user_id)
        values (v_list_id, auth.uid())
        on conflict do nothing;
end if;

return v_list_id;
end;
$$;

create function public.list_shared_rankings()
    returns setof public.ranking_lists
language sql
stable
security definer
set search_path = ''
as $$
select list.*
from public.ranking_lists list
         join public.ranking_members member
              on member.list_id = list.id
where member.user_id = auth.uid()
order by list.created_at desc, list.id;
$$;

create function public.get_shared_ranking(p_list_id uuid)
    returns jsonb
    language plpgsql
stable
security definer
set search_path = ''
as $$
declare
saved_list public.ranking_lists;
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

select *
into saved_list
from public.ranking_lists
where id = p_list_id;

if not found or (
        saved_list.owner_id <> auth.uid()
        and not exists (
            select 1
            from public.ranking_members
            where list_id = p_list_id and user_id = auth.uid()
        )
    ) then
        raise exception 'ranking_unavailable'
            using errcode = 'PT404';
end if;

return jsonb_build_object(
        'ranking_list', to_jsonb(saved_list),
        'entries', coalesce((
                                select jsonb_agg(
                                               to_jsonb(entry)
                                                   order by entry.position, entry.id
                                       )
                                from public.ranking_entries entry
                                where entry.list_id = p_list_id
                                  and entry.owner_id = saved_list.owner_id
                            ), '[]'::jsonb),
        'catalog_items', coalesce((
                                      select jsonb_agg(
                                                     to_jsonb(item)
                                                         order by item.name, item.id
                                             )
                                      from public.catalog_items item
                                      where item.owner_id = saved_list.owner_id
                                        and exists (
                                          select 1
                                          from public.ranking_entries entry
                                          where entry.list_id = p_list_id
                                            and entry.owner_id = item.owner_id
                                            and entry.item_id = item.id
                                      )
                                  ), '[]'::jsonb)
       );
end;
$$;

create function public.get_ranking_members(p_list_id uuid)
    returns setof public.ranking_members
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

    if not exists (
        select 1
        from public.ranking_lists
        where id = p_list_id and owner_id = auth.uid()
    ) then
        raise exception 'ranking_unavailable'
            using errcode = 'PT404';
end if;

return query
select *
from public.ranking_members
where list_id = p_list_id
order by joined_at, user_id;
end;
$$;

create function public.leave_shared_ranking(p_list_id uuid)
    returns boolean
    language plpgsql
security definer
set search_path = ''
as $$
declare
list_owner uuid;
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

select owner_id
into list_owner
from public.ranking_lists list
where list.id = p_list_id
  and (
    list.owner_id = auth.uid()
        or exists (
        select 1
        from public.ranking_members member
        where member.list_id = list.id
          and member.user_id = auth.uid()
    )
    )
    for update;

if list_owner = auth.uid() then
        raise exception 'owner_cannot_leave'
            using errcode = 'PT400';
end if;

delete from public.ranking_members
where list_id = p_list_id and user_id = auth.uid();

return true;
end;
$$;

create function public.remove_ranking_member(
    p_list_id uuid,
    p_user_id uuid
)
    returns boolean
    language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

    perform 1
    from public.ranking_lists
    where id = p_list_id and owner_id = auth.uid()
    for update;

if not found then
        raise exception 'ranking_unavailable'
            using errcode = 'PT404';
end if;

    if p_user_id is null or p_user_id = auth.uid() then
        raise exception 'invalid_member'
            using errcode = 'PT400';
end if;

delete from public.ranking_members
where list_id = p_list_id and user_id = p_user_id;

if found then
update public.ranking_share_links
set token = default, created_at = now()
where list_id = p_list_id;
end if;

return true;
end;
$$;

create function public.stop_ranking_sharing(p_list_id uuid)
    returns boolean
    language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

    perform 1
    from public.ranking_lists
    where id = p_list_id and owner_id = auth.uid()
    for update;

if not found then
        raise exception 'ranking_unavailable'
            using errcode = 'PT404';
end if;

delete from public.ranking_share_links
where list_id = p_list_id;

delete from public.ranking_members
where list_id = p_list_id;

return true;
end;
$$;

create function public.can_read_ranking_image(p_name text)
    returns boolean
    language sql
    stable
security definer
set search_path = ''
as $$
select exists (
    select 1
    from public.ranking_lists list
    where (
        list.owner_id = auth.uid()
            or exists (
            select 1
            from public.ranking_members member
            where member.list_id = list.id
              and member.user_id = auth.uid()
        )
        ) and (
        p_name =
        list.owner_id::text || '/' ||
                list.cover_image_id::text || '.jpg'
            or p_name =
                list.owner_id::text || '/' ||
                list.background_image_id::text || '.jpg'
            or exists (
                select 1
                from public.ranking_entries entry
                join public.catalog_items item
                    on item.owner_id = entry.owner_id
                   and item.id = entry.item_id
                where entry.list_id = list.id
                  and entry.owner_id = list.owner_id
                  and (
                      p_name =
                          item.owner_id::text || '/' ||
                          item.profile_image_id::text || '.jpg'
                      or p_name =
                          item.owner_id::text || '/' ||
                          item.background_image_id::text || '.jpg'
                  )
            )
        )
);
$$;

create policy profile_photos_read_shared_ranking
on storage.objects
for select to authenticated
               using (
               bucket_id = 'profile-photos'
               and public.can_read_ranking_image(name)
               );

revoke execute on function
    public.create_ranking_share_link(uuid, boolean),
    public.join_ranking_share(text),
    public.list_shared_rankings(),
    public.get_shared_ranking(uuid),
    public.get_ranking_members(uuid),
    public.leave_shared_ranking(uuid),
    public.remove_ranking_member(uuid, uuid),
    public.stop_ranking_sharing(uuid),
    public.can_read_ranking_image(text)
    from PUBLIC, anon;

grant execute on function
public.create_ranking_share_link(uuid, boolean),
    public.join_ranking_share(text),
    public.list_shared_rankings(),
    public.get_shared_ranking(uuid),
    public.get_ranking_members(uuid),
    public.leave_shared_ranking(uuid),
    public.remove_ranking_member(uuid, uuid),
    public.stop_ranking_sharing(uuid),
    public.can_read_ranking_image(text)
to authenticated;

commit;