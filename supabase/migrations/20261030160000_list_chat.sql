begin;

create table public.list_chat_profiles (
                                           user_id uuid primary key
                                               references auth.users(id) on delete cascade,
                                           display_name text not null
                                               check (char_length(btrim(display_name)) between 1 and 40),
                                           updated_at timestamptz not null default now()
);

create table public.list_chat_messages (
                                           id uuid primary key,
                                           ranking_list_id uuid
                                               references public.ranking_lists(id) on delete cascade,
                                           tier_list_id uuid
                                               references public.tier_lists(id) on delete cascade,
                                           author_id uuid
                                                     references auth.users(id) on delete set null,
                                           body text not null
                                               check (
                                                   char_length(body) between 1 and 2000
                                                       and body ~ '[^[:space:]]'
),
    created_at timestamptz not null default clock_timestamp(),
    check (num_nonnulls(ranking_list_id, tier_list_id) = 1)
);

create index list_chat_ranking_history
    on public.list_chat_messages(
                                 ranking_list_id, created_at desc, id desc
        )
    where ranking_list_id is not null;

create index list_chat_tier_history
    on public.list_chat_messages(
                                 tier_list_id, created_at desc, id desc
        )
    where tier_list_id is not null;

alter table public.list_chat_profiles enable row level security;
alter table public.list_chat_messages enable row level security;

revoke all on public.list_chat_profiles, public.list_chat_messages
    from PUBLIC, anon, authenticated;


create function public.can_access_list_chat(
    p_kind text,
    p_list_id uuid
)
    returns boolean
    language sql stable security definer
set search_path = ''
as $$
select auth.uid() is not null and (
    (
        p_kind = 'ranking'
            and exists (
            select 1 from public.ranking_lists list
            where list.id = p_list_id
              and (
                list.owner_id = auth.uid()
                    or exists (
                    select 1 from public.ranking_members
                    where list_id = list.id
                      and user_id = auth.uid()
                )
                )
        )
        )
        or (
        p_kind = 'tier'
            and exists (
            select 1 from public.tier_lists list
            where list.id = p_list_id
              and (
                list.owner_id = auth.uid()
                    or exists (
                    select 1 from public.tier_members
                    where list_id = list.id
                      and user_id = auth.uid()
                )
                )
        )
        )
    );
$$;

revoke all on function public.can_access_list_chat(text, uuid)
    from PUBLIC, anon, authenticated;


create function public.set_list_chat_name(p_name text)
    returns text
    language plpgsql security definer
set search_path = ''
as $$
declare
name text := btrim(p_name);
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

    if name is null
       or char_length(name) not between 1 and 40
       or name ~ '[[:cntrl:]]' then
        raise exception 'invalid_chat_name'
            using errcode = 'PT400';
end if;

insert into public.list_chat_profiles(user_id, display_name)
values(auth.uid(), name)
    on conflict(user_id) do update
                                set display_name = excluded.display_name,
                                updated_at = now();

return name;
end;
$$;


create function public.read_list_chat(
    p_kind text,
    p_list_id uuid
)
    returns jsonb
    language plpgsql stable security definer
set search_path = ''
as $$
declare
title text;
begin
    if not public.can_access_list_chat(p_kind, p_list_id) then
        raise exception 'chat_unavailable'
            using errcode = 'PT404';
end if;

    if p_kind = 'ranking' then
select list.title into title
from public.ranking_lists list
where id = p_list_id;
else
select list.title into title
from public.tier_lists list
where id = p_list_id;
end if;

return jsonb_build_object(
        'title', title,
        'viewerId', auth.uid(),
        'displayName', (
            select display_name
            from public.list_chat_profiles
            where user_id = auth.uid()
        ),
        'messages', coalesce((
                                 select jsonb_agg(
                                                jsonb_build_object(
                                                        'id', message.id,
                                                        'authorId', message.author_id,
                                                        'authorName', case
                                                                          when message.author_id is null
                                                                              then 'Gelöschtes Konto'
                                                                          else coalesce(profile.display_name, 'Mitglied')
                                                            end,
                                                        'body', message.body,
                                                        'createdAt', message.created_at
                                                )
                                                    order by message.created_at, message.id
                                        )
                                 from (
                                          select *
                                          from public.list_chat_messages
                                          where (
                                              p_kind = 'ranking'
                                                  and ranking_list_id = p_list_id
                                              ) or (
                                              p_kind = 'tier'
                                                  and tier_list_id = p_list_id
                                              )
                                          order by created_at desc, id desc
                                              limit 50
                                      ) message
                                          left join public.list_chat_profiles profile
                                                    on profile.user_id = message.author_id
                             ), '[]'::jsonb)
       );
end;
$$;


create function public.send_list_chat_message(
    p_kind text,
    p_list_id uuid,
    p_id uuid,
    p_body text
)
    returns uuid
    language plpgsql security definer
set search_path = ''
as $$
declare
content text := btrim(p_body, E' \t\r\n');
    saved public.list_chat_messages;
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

    if p_id is null
       or content is null
       or char_length(content) not between 1 and 2000
       or content !~ '[^[:space:]]' then
        raise exception 'invalid_chat_message'
            using errcode = 'PT400';
end if;

begin
        if p_kind = 'ranking' then
            perform id from public.ranking_lists
            where id = p_list_id
              and public.can_access_list_chat(p_kind, p_list_id)
            for share nowait;
        elsif p_kind = 'tier' then
            perform id from public.tier_lists
            where id = p_list_id
              and public.can_access_list_chat(p_kind, p_list_id)
            for share nowait;
else
            raise exception 'invalid_chat_kind'
                using errcode = 'PT400';
end if;

        if not found
           or not public.can_access_list_chat(p_kind, p_list_id) then
            raise exception 'chat_unavailable'
                using errcode = 'PT404';
end if;
exception when lock_not_available then
        raise exception 'chat_list_busy'
            using errcode = 'PT409';
end;

    if not exists (
        select 1 from public.list_chat_profiles
        where user_id = auth.uid()
    ) then
        raise exception 'chat_name_required'
            using errcode = 'PT400';
end if;

insert into public.list_chat_messages(
    id, ranking_list_id, tier_list_id, author_id, body
)
values(
          p_id,
          case when p_kind = 'ranking' then p_list_id end,
          case when p_kind = 'tier' then p_list_id end,
          auth.uid(),
          content
      )
    on conflict(id) do nothing;

select * into saved
from public.list_chat_messages
where id = p_id;

if saved.author_id is distinct from auth.uid()
       or saved.body is distinct from content
       or (
           p_kind = 'ranking'
           and saved.ranking_list_id is distinct from p_list_id
       )
       or (
           p_kind = 'tier'
           and saved.tier_list_id is distinct from p_list_id
       ) then
        raise exception 'chat_message_conflict'
            using errcode = 'PT409';
end if;

return saved.id;
end;
$$;


create function public.notify_list_chat_message()
    returns trigger
    language plpgsql security definer
set search_path = ''
as $$
declare
recipient uuid;
begin
for recipient in
select owner_id from public.ranking_lists
where id = NEW.ranking_list_id
union
select user_id from public.ranking_members
where list_id = NEW.ranking_list_id
union
select owner_id from public.tier_lists
where id = NEW.tier_list_id
union
select user_id from public.tier_members
where list_id = NEW.tier_list_id
    loop
begin
            perform realtime.send(
                '{}'::jsonb,
                'chat_changed',
                'delulu:user:' || recipient::text,
                true
            );
exception when others then
            raise warning 'deluLu chat notification unavailable: %',
                sqlerrm;
end;
end loop;

return NEW;
end;
$$;

revoke all on function public.notify_list_chat_message()
    from PUBLIC, anon, authenticated;

create trigger list_chat_message_live
    after insert on public.list_chat_messages
    for each row execute function public.notify_list_chat_message();


revoke all on function
    public.set_list_chat_name(text),
    public.read_list_chat(text, uuid),
    public.send_list_chat_message(text, uuid, uuid, text)
    from PUBLIC, anon, authenticated;

grant execute on function
public.set_list_chat_name(text),
    public.read_list_chat(text, uuid),
    public.send_list_chat_message(text, uuid, uuid, text)
to authenticated;

commit;