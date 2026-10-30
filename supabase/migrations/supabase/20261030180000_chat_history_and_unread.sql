begin;

-- Keep existing messages in their original order.
create sequence public.list_chat_sequence;

alter table public.list_chat_messages
    add column sequence bigint;

with numbered as (
    select
        id,
        row_number() over (order by created_at, id) as sequence
    from public.list_chat_messages
)
update public.list_chat_messages m
set sequence = n.sequence
    from numbered n
where n.id = m.id;

select setval(
               'public.list_chat_sequence',
               greatest(
                       coalesce(
                               (select max(sequence) from public.list_chat_messages),
                               0
                       ) + 1,
                       1
               ),
               false
       );

alter table public.list_chat_messages
    alter column sequence
        set default nextval('public.list_chat_sequence'),
alter column sequence set not null;

alter sequence public.list_chat_sequence
    owned by public.list_chat_messages.sequence;

revoke all on sequence public.list_chat_sequence
    from PUBLIC, anon, authenticated;

create unique index list_chat_sequence_unique
    on public.list_chat_messages(sequence);

create index list_chat_ranking_cursor
    on public.list_chat_messages(ranking_list_id, sequence);

create index list_chat_tier_cursor
    on public.list_chat_messages(tier_list_id, sequence);

create table public.list_chat_reads (
                                        user_id uuid not null
                                            references auth.users(id) on delete cascade,
                                        ranking_list_id uuid
                                            references public.ranking_lists(id) on delete cascade,
                                        tier_list_id uuid
                                            references public.tier_lists(id) on delete cascade,
                                        through_sequence bigint not null
                                            check (through_sequence >= 0),
                                        check (num_nonnulls(ranking_list_id, tier_list_id) = 1)
);

create unique index list_chat_reads_ranking
    on public.list_chat_reads(user_id, ranking_list_id)
    where ranking_list_id is not null;

create unique index list_chat_reads_tier
    on public.list_chat_reads(user_id, tier_list_id)
    where tier_list_id is not null;

alter table public.list_chat_reads enable row level security;

revoke all on public.list_chat_reads
    from PUBLIC, anon, authenticated;

create function public.read_list_chat_page(
    p_kind text,
    p_list_id uuid,
    p_before bigint default null,
    p_from bigint default null
)
    returns jsonb
    language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
    if not public.can_access_list_chat(p_kind, p_list_id) then
        raise exception 'chat_unavailable' using errcode = 'PT404';
end if;

    if (p_before is not null and p_from is not null)
        or p_before < 1
        or p_from < 1 then
        raise exception 'invalid_chat_cursor' using errcode = 'PT400';
end if;

with selected as (
    select *
    from public.list_chat_messages
    where (
        (p_kind = 'ranking' and ranking_list_id = p_list_id)
            or (p_kind = 'tier' and tier_list_id = p_list_id)
        )
      and (p_before is null or sequence < p_before)
      and (p_from is null or sequence >= p_from)
    order by sequence desc
    limit case when p_from is null then 50 else null end
    )
select jsonb_build_object(
               'title',
               case when p_kind = 'ranking' then
                        (select title from public.ranking_lists where id = p_list_id)
                    else
                        (select title from public.tier_lists where id = p_list_id)
                   end,
               'viewerId', auth.uid(),
               'displayName', (
                   select display_name
                   from public.list_chat_profiles
                   where user_id = auth.uid()
               ),
               'messages', coalesce((
                                        select jsonb_agg(
                                                       jsonb_build_object(
                                                               'id', m.id,
                                                               'sequence', m.sequence::text,
                                                               'authorId', m.author_id,
                                                               'authorName',
                                                               case when m.author_id is null then
                                                                        'Gelöschtes Konto'
                                                                    else
                                                                        coalesce(p.display_name, 'Mitglied')
                                                                   end,
                                                               'body', m.body,
                                                               'createdAt', m.created_at
                                                       )
                                                           order by m.sequence
                                               )
                                        from selected m
                                                 left join public.list_chat_profiles p
                                                           on p.user_id = m.author_id
                                    ), '[]'::jsonb),
               'hasMore', exists (
            select 1
            from public.list_chat_messages
            where (
                (p_kind = 'ranking' and ranking_list_id = p_list_id)
                    or (p_kind = 'tier' and tier_list_id = p_list_id)
                )
              and sequence < coalesce(
                    (select min(sequence) from selected),
                    p_from,
                    p_before
                             )
        )
       ) into result;

return result;
end;
$$;

create or replace function public.read_list_chat(
    p_kind text,
    p_list_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
select public.read_list_chat_page(p_kind, p_list_id)
           $$;

create function public.list_chat_unread()
    returns jsonb
    language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then
        raise exception 'authentication_required' using errcode = '42501';
end if;

return (
    with accessible as (
        select 'ranking'::text kind, id
        from public.ranking_lists
        where owner_id = auth.uid()

        union

        select 'ranking', list_id
        from public.ranking_members
        where user_id = auth.uid()

        union

        select 'tier', id
        from public.tier_lists
        where owner_id = auth.uid()

        union

        select 'tier', list_id
        from public.tier_members
        where user_id = auth.uid()
    ),
         counts as (
             select a.kind, a.id, count(*) as count
    from accessible a
    join public.list_chat_messages m on
    (a.kind = 'ranking' and m.ranking_list_id = a.id)
    or (a.kind = 'tier' and m.tier_list_id = a.id)
    left join public.list_chat_reads r on
    r.user_id = auth.uid()
    and (
    (a.kind = 'ranking' and r.ranking_list_id = a.id)
    or (a.kind = 'tier' and r.tier_list_id = a.id)
    )
    where m.author_id is distinct from auth.uid()
    and m.sequence > coalesce(r.through_sequence, 0)
    group by a.kind, a.id
    )
select coalesce(
               jsonb_agg(
                       jsonb_build_object(
                               'kind', kind,
                               'id', id,
                               'count', count
                       )
               ),
               '[]'::jsonb
       )
from counts
    );
end;
$$;

create function public.mark_list_chat_read(
    p_kind text,
    p_list_id uuid,
    p_through bigint
)
    returns boolean
    language plpgsql
security definer
set search_path = ''
as $$
declare
last_sequence bigint;
    changed integer;
begin
    if not public.can_access_list_chat(p_kind, p_list_id) then
        raise exception 'chat_unavailable' using errcode = 'PT404';
end if;

select max(sequence)
into last_sequence
from public.list_chat_messages
where (p_kind = 'ranking' and ranking_list_id = p_list_id)
   or (p_kind = 'tier' and tier_list_id = p_list_id);

if p_through is null or p_through < 1 then
        raise exception 'invalid_chat_cursor' using errcode = 'PT400';
end if;

    if last_sequence is null then
        return true;
end if;

    if p_kind = 'ranking' then
        insert into public.list_chat_reads(
            user_id, ranking_list_id, through_sequence
        )
        values(
            auth.uid(), p_list_id, least(p_through, last_sequence)
        )
        on conflict(user_id, ranking_list_id)
            where ranking_list_id is not null
        do update
                      set through_sequence = excluded.through_sequence
           where public.list_chat_reads.through_sequence
               < excluded.through_sequence;
else
        insert into public.list_chat_reads(
            user_id, tier_list_id, through_sequence
        )
        values(
            auth.uid(), p_list_id, least(p_through, last_sequence)
        )
        on conflict(user_id, tier_list_id)
            where tier_list_id is not null
        do update
               set through_sequence = excluded.through_sequence
           where public.list_chat_reads.through_sequence
               < excluded.through_sequence;
end if;

get diagnostics changed = row_count;

if changed > 0 then
begin
            perform realtime.send(
                '{}'::jsonb,
                'chat_changed',
                'delulu:user:' || auth.uid()::text,
                true
            );
exception when others then
            raise warning 'deluLu read notification unavailable: %', sqlerrm;
end;
end if;

return true;
end;
$$;

-- Send order also determines the read cursor order.
create or replace function public.send_list_chat_message(
    p_kind text,
    p_list_id uuid,
    p_id uuid,
    p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
content text := btrim(p_body, E' \t\r\n');
    saved public.list_chat_messages;
begin
    if auth.uid() is null then
        raise exception 'authentication_required' using errcode = '42501';
end if;

    if p_id is null
        or content is null
        or char_length(content) not between 1 and 2000
        or content !~ '[^[:space:]]' then
        raise exception 'invalid_chat_message' using errcode = 'PT400';
end if;

begin
        if p_kind = 'ranking' then
            perform id
            from public.ranking_lists
            where id = p_list_id
                and public.can_access_list_chat(p_kind, p_list_id)
            for update nowait;
elsif p_kind = 'tier' then
            perform id
            from public.tier_lists
            where id = p_list_id
                and public.can_access_list_chat(p_kind, p_list_id)
            for update nowait;
else
            raise exception 'invalid_chat_kind' using errcode = 'PT400';
end if;

        if not found
            or not public.can_access_list_chat(p_kind, p_list_id) then
            raise exception 'chat_unavailable' using errcode = 'PT404';
end if;
exception when lock_not_available then
        raise exception 'chat_list_busy' using errcode = 'PT409';
end;

    if not exists(
        select 1
        from public.list_chat_profiles
        where user_id = auth.uid()
    ) then
        raise exception 'chat_name_required' using errcode = 'PT400';
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

select *
into saved
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
        raise exception 'chat_id_conflict' using errcode = 'PT409';
end if;

return saved.id;
end;
$$;

create function public.delete_list_chat_message(
    p_kind text,
    p_list_id uuid,
    p_id uuid
)
    returns boolean
    language plpgsql
security definer
set search_path = ''
as $$
begin
begin
        if p_kind = 'ranking' then
            perform id
            from public.ranking_lists
            where id = p_list_id
            for share nowait;
        elsif p_kind = 'tier' then
            perform id
            from public.tier_lists
            where id = p_list_id
            for share nowait;
else
            raise exception 'chat_unavailable' using errcode = 'PT404';
end if;

        if not found
            or not public.can_access_list_chat(p_kind, p_list_id) then
            raise exception 'chat_unavailable' using errcode = 'PT404';
end if;
exception when lock_not_available then
        raise exception 'chat_list_busy' using errcode = 'PT409';
end;

    if exists(
        select 1
        from public.list_chat_messages
        where id = p_id
            and (
                (p_kind = 'ranking' and ranking_list_id = p_list_id)
                or (p_kind = 'tier' and tier_list_id = p_list_id)
            )
            and author_id is distinct from auth.uid()
    ) then
        raise exception 'not_your_message' using errcode = '42501';
end if;

delete from public.list_chat_messages
where id = p_id
  and author_id = auth.uid()
  and (
    (p_kind = 'ranking' and ranking_list_id = p_list_id)
        or (p_kind = 'tier' and tier_list_id = p_list_id)
    );

return true;
end;
$$;

create or replace function public.notify_list_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
recipient uuid;
    ranking_id uuid;
    tier_id uuid;
begin
    if TG_OP = 'DELETE' then
        ranking_id := OLD.ranking_list_id;
        tier_id := OLD.tier_list_id;
else
        ranking_id := NEW.ranking_list_id;
        tier_id := NEW.tier_list_id;
end if;

for recipient in
select owner_id
from public.ranking_lists
where id = ranking_id

union

select user_id
from public.ranking_members
where list_id = ranking_id

union

select owner_id
from public.tier_lists
where id = tier_id

union

select user_id
from public.tier_members
where list_id = tier_id
    loop
begin
            perform realtime.send(
                '{}'::jsonb,
                'chat_changed',
                'delulu:user:' || recipient::text,
                true
            );
exception when others then
            raise warning 'deluLu chat notification unavailable: %', sqlerrm;
end;
end loop;

    if TG_OP = 'DELETE' then
        return OLD;
else
        return NEW;
end if;
end;
$$;

create trigger list_chat_message_deleted
    after delete on public.list_chat_messages
    for each row execute function public.notify_list_chat_message();

revoke all on function
    public.read_list_chat_page(text, uuid, bigint, bigint),
    public.list_chat_unread(),
    public.mark_list_chat_read(text, uuid, bigint),
    public.delete_list_chat_message(text, uuid, uuid)
    from PUBLIC, anon, authenticated;

grant execute on function
public.read_list_chat_page(text, uuid, bigint, bigint),
    public.list_chat_unread(),
    public.mark_list_chat_read(text, uuid, bigint),
    public.delete_list_chat_message(text, uuid, uuid)
to authenticated;

commit;