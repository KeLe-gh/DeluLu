begin;

create table if not exists public.signup_invites (
                                                     token_hash text primary key
                                                     check (token_hash ~ '^[0-9a-f]{64}$'),
    label text not null unique,
    created_at timestamptz not null default now(),
    revoked_at timestamptz
    );

alter table public.signup_invites enable row level security;

revoke all on table public.signup_invites
    from public, anon, authenticated;

grant select on table public.signup_invites
    to supabase_auth_admin;

grant usage on schema public
    to supabase_auth_admin;

drop policy if exists signup_invites_auth_read
    on public.signup_invites;

create policy signup_invites_auth_read
    on public.signup_invites
    for select
                                              to supabase_auth_admin
                                              using (true);

create or replace function public.require_signup_invite(event jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
invite_token text := event #>> '{user,user_metadata,invite_token}';
begin
    if coalesce(invite_token, '') ~ '^[0-9a-f]{64}$' then
        if exists (
            select 1
            from public.signup_invites
            where token_hash = encode(
                sha256(convert_to(invite_token, 'UTF8')), 'hex'
            )
              and revoked_at is null
        ) then
            return '{}'::jsonb;
end if;
end if;

return jsonb_build_object(
        'error', jsonb_build_object(
                'http_code', 403,
                'message', 'Für die Registrierung brauchst du einen gültigen Einladungslink.'
                 )
       );
end;
$$;

revoke all on function public.require_signup_invite(jsonb)
    from public, anon, authenticated;

grant execute on function public.require_signup_invite(jsonb)
    to supabase_auth_admin;

commit;