begin;

create table public.chat_push_origins (
                                          origin text primary key check (
                                              origin ~ '^https://[a-z0-9][a-z0-9.-]*(:[0-9]+)?$'
                                              or origin ~ '^http://localhost:[0-9]+$'
),
    enabled boolean not null default false
);

create table public.chat_push_subscriptions (
                                                id uuid primary key default gen_random_uuid(),
                                                user_id uuid not null references auth.users(id) on delete cascade,
                                                endpoint text not null unique check (
                                                    length(endpoint) <= 2048
                                                        and endpoint ~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com)/[^[:space:]]+$'
),
    p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{87}$'),
    auth text not null check (auth ~ '^[A-Za-z0-9_-]{22}$'),
    origin text not null references public.chat_push_origins(origin) on delete cascade,
    updated_at timestamptz not null default now()
);

create index chat_push_user
    on public.chat_push_subscriptions(user_id);

create table public.chat_push_mutes (
                                        user_id uuid not null references auth.users(id) on delete cascade,
                                        ranking_list_id uuid references public.ranking_lists(id) on delete cascade,
                                        tier_list_id uuid references public.tier_lists(id) on delete cascade,
                                        check (num_nonnulls(ranking_list_id, tier_list_id) = 1)
);

create unique index chat_push_mute_ranking
    on public.chat_push_mutes(user_id, ranking_list_id)
    where ranking_list_id is not null;

create unique index chat_push_mute_tier
    on public.chat_push_mutes(user_id, tier_list_id)
    where tier_list_id is not null;

create table public.chat_push_jobs (
                                       id bigint generated always as identity primary key,
                                       subscription_id uuid not null references public.chat_push_subscriptions(id) on delete cascade,
                                       message_id uuid not null references public.list_chat_messages(id) on delete cascade,
                                       attempts integer not null default 0,
                                       run_after timestamptz not null default (clock_timestamp() + interval '2 seconds'),
                                       lease_token uuid,
                                       lease_until timestamptz,
                                       created_at timestamptz not null default now(),
                                       unique(subscription_id, message_id)
);

create index chat_push_due
    on public.chat_push_jobs(run_after);

alter table public.chat_push_origins enable row level security;
alter table public.chat_push_subscriptions enable row level security;
alter table public.chat_push_mutes enable row level security;
alter table public.chat_push_jobs enable row level security;

revoke all on
    public.chat_push_origins,
    public.chat_push_subscriptions,
    public.chat_push_mutes,
    public.chat_push_jobs
    from PUBLIC, anon, authenticated, service_role;

revoke all on sequence public.chat_push_jobs_id_seq
    from PUBLIC, anon, authenticated, service_role;

create function public.register_chat_push(
    p_subscription jsonb,
    p_origin text
)
    returns uuid
    language plpgsql
security definer
set search_path = ''
as $$
declare
result uuid;
    owner uuid;
    address text := p_subscription->>'endpoint';
begin
    if auth.uid() is null then
        raise exception 'authentication_required' using errcode = '42501';
end if;

    if not exists(
        select 1 from public.chat_push_origins
        where origin = p_origin and enabled
    ) then
        raise exception 'push_origin_disabled' using errcode = 'PT403';
end if;

    perform pg_advisory_xact_lock(
        hashtextextended(auth.uid()::text, 218)
    );

select user_id into owner
from public.chat_push_subscriptions
where endpoint = address;

if owner is not null and owner <> auth.uid() then
        raise exception 'push_device_already_registered' using errcode = 'PT409';
end if;

    if owner is null and (
        select count(*) from public.chat_push_subscriptions
        where user_id = auth.uid()
    ) >= 10 then
        raise exception 'too_many_push_devices' using errcode = 'PT400';
end if;

insert into public.chat_push_subscriptions(
    user_id, endpoint, p256dh, auth, origin
)
values(
          auth.uid(),
          address,
          p_subscription->'keys'->>'p256dh',
          p_subscription->'keys'->>'auth',
          p_origin
      )
    on conflict(endpoint) do update
                                 set p256dh = excluded.p256dh,
                                 auth = excluded.auth,
                                 origin = excluded.origin,
                                 updated_at = now()
                             where public.chat_push_subscriptions.user_id = auth.uid()
                                 returning id into result;

if result is null then
        raise exception 'push_device_already_registered' using errcode = 'PT409';
end if;

return result;
end;
$$;

create function public.has_chat_push(p_endpoint text)
    returns boolean
    language sql
    stable
security definer
set search_path = ''
as $$
select auth.uid() is not null and exists(
    select 1 from public.chat_push_subscriptions
    where user_id = auth.uid() and endpoint = p_endpoint
)
           $$;

create function public.unregister_chat_push(p_endpoint text)
    returns boolean
    language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then
        raise exception 'authentication_required' using errcode = '42501';
end if;

delete from public.chat_push_subscriptions
where user_id = auth.uid() and endpoint = p_endpoint;

return not exists(
    select 1 from public.chat_push_subscriptions
    where endpoint = p_endpoint
);
end;
$$;

create function public.get_chat_push_muted(
    p_kind text,
    p_list_id uuid
)
    returns boolean
    language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if not public.can_access_list_chat(p_kind, p_list_id) then
        raise exception 'chat_unavailable' using errcode = 'PT404';
end if;

return exists(
    select 1 from public.chat_push_mutes
    where user_id = auth.uid() and (
        (p_kind = 'ranking' and ranking_list_id = p_list_id)
            or (p_kind = 'tier' and tier_list_id = p_list_id)
        )
);
end;
$$;

create function public.set_chat_push_muted(
    p_kind text,
    p_list_id uuid,
    p_muted boolean
)
    returns boolean
    language plpgsql
security definer
set search_path = ''
as $$
begin
    if not public.can_access_list_chat(p_kind, p_list_id) then
        raise exception 'chat_unavailable' using errcode = 'PT404';
end if;

    if p_muted is null then
        raise exception 'invalid_push_setting' using errcode = 'PT400';
end if;

    if p_muted then
        insert into public.chat_push_mutes(
            user_id, ranking_list_id, tier_list_id
        )
        values(
            auth.uid(),
            case when p_kind = 'ranking' then p_list_id end,
            case when p_kind = 'tier' then p_list_id end
        )
        on conflict do nothing;
else
delete from public.chat_push_mutes
where user_id = auth.uid() and (
    (p_kind = 'ranking' and ranking_list_id = p_list_id)
        or (p_kind = 'tier' and tier_list_id = p_list_id)
    );
end if;

begin
        perform realtime.send(
            '{}'::jsonb,
            'chat_changed',
            'delulu:user:' || auth.uid()::text,
            true
        );
exception when others then
        raise warning 'deluLu push setting notification unavailable';
end;

return p_muted;
end;
$$;

create function public.chat_push_allowed(
    p_subscription uuid,
    p_message uuid
)
    returns boolean
    language sql
    stable
security definer
set search_path = ''
as $$
select exists(
    select 1
    from public.chat_push_subscriptions s
             join public.chat_push_origins o
                  on o.origin = s.origin and o.enabled
             join public.list_chat_messages m
                  on m.id = p_message
    where s.id = p_subscription
      and m.author_id is distinct from s.user_id
        and (
                                           exists(
                                               select 1 from public.ranking_lists l
                                               where l.id = m.ranking_list_id and (
                                                   l.owner_id = s.user_id or exists(
                                                       select 1 from public.ranking_members
                                                       where list_id = l.id and user_id = s.user_id
                                                   )
                                                   )
                                           )
                                               or exists(
                                               select 1 from public.tier_lists l
                                               where l.id = m.tier_list_id and (
                                                   l.owner_id = s.user_id or exists(
                                                       select 1 from public.tier_members
                                                       where list_id = l.id and user_id = s.user_id
                                                   )
                                                   )
                                           )
                                           )
        and not exists(
            select 1 from public.chat_push_mutes
            where user_id = s.user_id and (
                ranking_list_id = m.ranking_list_id
                    or tier_list_id = m.tier_list_id
                )
        )
        and not exists(
            select 1 from public.list_chat_reads
            where user_id = s.user_id
              and through_sequence >= m.sequence
              and (
                ranking_list_id = m.ranking_list_id
                    or tier_list_id = m.tier_list_id
                )
        )
)
           $$;

create function public.wake_chat_push_worker()
    returns void
    language plpgsql
security definer
set search_path = ''
as $$
declare
address text;
    secret text;
begin
    if not exists(select 1 from public.chat_push_jobs) then
        return;
end if;

select decrypted_secret into address
from vault.decrypted_secrets
where name = 'delulu_push_worker_url'
    limit 1;

select decrypted_secret into secret
from vault.decrypted_secrets
where name = 'delulu_push_worker_secret'
    limit 1;

if address is null or secret is null then
        return;
end if;

    perform net.http_post(
        url := address,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-push-secret', secret
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
    );
exception when others then
    raise warning 'deluLu push worker wake-up unavailable';
end;
$$;

create function public.enqueue_chat_push()
    returns trigger
    language plpgsql
security definer
set search_path = ''
as $$
declare inserted integer;
begin
insert into public.chat_push_jobs(
    subscription_id, message_id
)
select id, NEW.id
from public.chat_push_subscriptions
where public.chat_push_allowed(id, NEW.id)
    on conflict do nothing;

get diagnostics inserted = row_count;

if inserted > 0 then
        perform public.wake_chat_push_worker();
end if;

return NEW;
exception when others then
    raise warning 'deluLu push queue unavailable';
return NEW;
end;
$$;

create trigger list_chat_message_push
    after insert on public.list_chat_messages
    for each row execute function public.enqueue_chat_push();

create function public.claim_chat_push_jobs()
    returns jsonb
    language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
delete from public.chat_push_jobs
where (
    attempts >= 5
        and (
        lease_until is null
            or lease_until < clock_timestamp()
        )
    )
   or created_at < now() - interval '1 day'
   or not public.chat_push_allowed(subscription_id, message_id);

with picked as (
    select id from public.chat_push_jobs
    where run_after <= clock_timestamp()
      and (
        lease_until is null
            or lease_until < clock_timestamp()
        )
    order by id
    for update skip locked
        limit 20
    ),
    leased as (
update public.chat_push_jobs j
set lease_token = gen_random_uuid(),
    lease_until = clock_timestamp() + interval '3 minutes',
    attempts = attempts + 1
from picked p
where j.id = p.id
    returning j.id::text, j.lease_token
    )
select coalesce(
               jsonb_agg(
                       jsonb_build_object(
                               'id', id,
                               'token', lease_token
                       )
               ),
               '[]'::jsonb
       )
into result
from leased;

return result;
end;
$$;

create function public.prepare_chat_push_job(
    p_id bigint,
    p_token uuid
)
    returns jsonb
    language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
select jsonb_build_object(
               'endpoint', s.endpoint,
               'keys', jsonb_build_object(
                       'p256dh', s.p256dh,
                       'auth', s.auth
                       ),
               'origin', s.origin,
               'userId', s.user_id,
               'kind',
               case when m.ranking_list_id is not null
                        then 'ranking' else 'tier' end,
               'listId',
               coalesce(m.ranking_list_id, m.tier_list_id)
       )
into result
from public.chat_push_jobs j
         join public.chat_push_subscriptions s
              on s.id = j.subscription_id
         join public.list_chat_messages m
              on m.id = j.message_id
where j.id = p_id
  and j.lease_token = p_token
  and j.lease_until > clock_timestamp()
  and public.chat_push_allowed(
        j.subscription_id, j.message_id
      );

if result is null then
delete from public.chat_push_jobs
where id = p_id
  and lease_token = p_token
  and not public.chat_push_allowed(
        subscription_id, message_id
          );
end if;

return result;
end;
$$;

create function public.finish_chat_push_job(
    p_id bigint,
    p_token uuid,
    p_status integer,
    p_retry_after integer default null
)
    returns boolean
    language plpgsql
security definer
set search_path = ''
as $$
declare
device uuid;
    tried integer;
begin
select subscription_id, attempts into device, tried
from public.chat_push_jobs
where id = p_id and lease_token = p_token
    for update;

if not found then
        return false;
end if;

    if p_status in (404, 410) then
delete from public.chat_push_subscriptions
where id = device;
elsif p_status between 200 and 299 or tried >= 5 then
delete from public.chat_push_jobs
where id = p_id;
else
update public.chat_push_jobs
set lease_token = null,
    lease_until = null,
    run_after = clock_timestamp() + make_interval(
            secs => least(
                    3600,
                    greatest(
                            30,
                            coalesce(
                                    p_retry_after,
                                    30 * (2 ^ tried)::integer
                            )
                    )
                    )
                                    )
where id = p_id;
end if;

return true;
end;
$$;

revoke all on function
    public.register_chat_push(jsonb, text),
    public.has_chat_push(text),
    public.unregister_chat_push(text),
    public.get_chat_push_muted(text, uuid),
    public.set_chat_push_muted(text, uuid, boolean),
    public.chat_push_allowed(uuid, uuid),
    public.wake_chat_push_worker(),
    public.enqueue_chat_push(),
    public.claim_chat_push_jobs(),
    public.prepare_chat_push_job(bigint, uuid),
    public.finish_chat_push_job(bigint, uuid, integer, integer)
    from PUBLIC, anon, authenticated, service_role;

grant execute on function
public.register_chat_push(jsonb, text),
    public.has_chat_push(text),
    public.unregister_chat_push(text),
    public.get_chat_push_muted(text, uuid),
    public.set_chat_push_muted(text, uuid, boolean)
to authenticated;

grant execute on function
    public.claim_chat_push_jobs(),
    public.prepare_chat_push_job(bigint, uuid),
    public.finish_chat_push_job(bigint, uuid, integer, integer)
to service_role;

commit;