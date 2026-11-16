-- =====================================================================
-- Pickleball Tournament Control — Supabase schema v1 (Day 1)
-- Run once in Supabase → SQL Editor. Safe on an empty project.
--
-- Security model
--   * Everyone (anon) can READ tournaments, courts, teams, matches, events.
--   * Organizers (Supabase Auth users listed in public.organizers) can
--     edit setup data and override scores (every override is logged).
--   * Referees have NO account. They hold a per-court ref key (from QR)
--     + optional PIN. The key is bound to the first device that claims it.
--   * Scores change ONLY through the score_* / org_* functions below.
--     Direct writes to score columns and match_events are blocked.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table public.tournaments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  event_date  date,
  -- short link for friendly URLs (/<slug>/tv); null = use id
  slug        text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 40),
  created_at  timestamptz not null default now()
);

create table public.organizers (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  primary key (tournament_id, user_id)
);

create table public.courts (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name          text not null,
  sort          int  not null default 0
);

-- A tournament is an ordered list of stages: Group stage → Series A / Series B ...
create table public.stages (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name          text not null,
  kind          text not null check (kind in ('round_robin', 'knockout')),
  sort          int  not null default 0,
  -- default game rules for matches in this stage (each match can override)
  points_to     int  not null default 11 check (points_to > 0),
  win_by        int  not null default 2  check (win_by in (1, 2)),
  cap           int,                       -- null = no cap
  -- e.g. {"advance": [{"ranks": [1,2], "to_stage": "<uuid>"}, {"ranks": [3,4], "to_stage": "<uuid>"}]}
  config        jsonb not null default '{}'::jsonb,
  check (cap is null or cap >= points_to)
);

create table public.groups (
  id        uuid primary key default gen_random_uuid(),
  stage_id  uuid not null references public.stages(id) on delete cascade,
  name      text not null,
  sort      int  not null default 0
);

create table public.teams (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name          text not null,
  player1       text not null,
  player2       text not null,
  group_id      uuid references public.groups(id) on delete set null,
  seed          int
);

create table public.matches (
  id             bigint generated always as identity primary key,
  tournament_id  uuid not null references public.tournaments(id) on delete cascade,
  stage_id       uuid not null references public.stages(id) on delete cascade,
  group_id       uuid references public.groups(id) on delete cascade,
  round          int  not null default 1,
  position       int  not null default 1,
  label          text,                     -- "M12", "SF1", "Final"
  -- placeholders resolved later: 'G:<group_id>:<rank>' or 'W:<match_id>' / 'L:<match_id>'
  slot_a         text,
  slot_b         text,
  team_a_id      uuid references public.teams(id) on delete set null,
  team_b_id      uuid references public.teams(id) on delete set null,
  court_id       uuid references public.courts(id) on delete set null,
  queue_order    int,
  status         text not null default 'scheduled'
                 check (status in ('scheduled', 'called', 'live', 'finished', 'confirmed')),
  result_type    text not null default 'normal'
                 check (result_type in ('normal', 'forfeit', 'retired', 'no_show')),
  -- game rules (copied from stage on insert if left null)
  points_to      int,
  win_by         int check (win_by in (1, 2)),
  cap            int,
  -- live state (written only by functions)
  score_a        int not null default 0,
  score_b        int not null default 0,
  serving_team   text check (serving_team in ('A', 'B')),
  server_number  smallint check (server_number in (1, 2)),
  sides_switched boolean not null default false,
  winner         text check (winner in ('A', 'B')),
  started_at     timestamptz,
  finished_at    timestamptz,
  updated_at     timestamptz not null default now()
);
create index matches_court_idx on public.matches (court_id, status);
create index matches_stage_idx on public.matches (stage_id, round, position);

-- Append-only log. Each row stores the match state AFTER the event (snapshot),
-- so undo = restore the previous snapshot, and the full audit trail is kept.
create table public.match_events (
  id               bigint generated always as identity primary key,
  match_id         bigint not null references public.matches(id) on delete cascade,
  kind             text not null
                   check (kind in ('start', 'rally', 'undo', 'special', 'override', 'confirm', 'reopen')),
  rally_winner     text check (rally_winner in ('A', 'B')),
  undoes_event_id  bigint references public.match_events(id),
  actor            text not null,          -- 'ref:<ref_token_id>' or 'org:<user_id>'
  note             text,
  score_a          int,
  score_b          int,
  serving_team     text,
  server_number    smallint,
  sides_switched   boolean,
  created_at       timestamptz not null default now()
);
create index match_events_match_idx on public.match_events (match_id, id);

-- One ref key per court. Only the SHA-256 hash is stored.
create table public.ref_tokens (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  court_id      uuid not null references public.courts(id) on delete cascade,
  label         text,
  token_hash    text not null unique,
  pin_hash      text,
  device_id     text,                      -- bound on first claim
  expires_at    timestamptz not null,
  revoked       boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.is_organizer(p_tournament uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organizers o
    where o.tournament_id = p_tournament and o.user_id = auth.uid()
  );
$$;

create or replace function public._sha256(p text)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(p, 'sha256'), 'hex');
$$;

create or replace function public._is_game_won(a int, b int, p_to int, p_win_by int, p_cap int)
returns boolean language sql immutable set search_path = '' as $$
  select (greatest(a, b) >= p_to and abs(a - b) >= p_win_by)
      or (p_cap is not null and greatest(a, b) >= p_cap);
$$;

-- Copy stage rules into a new match when not given.
create or replace function public._matches_fill_rules()
returns trigger language plpgsql set search_path = '' as $$
declare s public.stages;
begin
  select * into s from public.stages where id = new.stage_id;
  new.points_to := coalesce(new.points_to, s.points_to);
  new.win_by    := coalesce(new.win_by, s.win_by);
  if new.cap is null and tg_op = 'INSERT' then new.cap := s.cap; end if;
  if new.tournament_id is null then new.tournament_id := s.tournament_id; end if;
  return new;
end $$;
create trigger matches_fill_rules before insert on public.matches
  for each row execute function public._matches_fill_rules();

-- Creator of a tournament becomes its organizer.
create or replace function public._tournament_add_creator()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    insert into public.organizers (tournament_id, user_id) values (new.id, auth.uid())
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger tournament_add_creator after insert on public.tournaments
  for each row execute function public._tournament_add_creator();

-- Who may score this match? Organizer (logged in) or the ref key for its court.
create or replace function public._authorize_scoring(p_match public.matches, p_token text, p_device text)
returns text language plpgsql security definer set search_path = '' as $$
declare t public.ref_tokens;
begin
  if auth.uid() is not null and public.is_organizer(p_match.tournament_id) then
    return 'org:' || auth.uid()::text;
  end if;
  if p_token is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into t from public.ref_tokens where token_hash = public._sha256(p_token);
  if not found or t.revoked or t.expires_at < now() then
    raise exception 'ref key invalid or expired' using errcode = '42501';
  end if;
  if t.device_id is null then
    raise exception 'ref key not claimed yet — scan the QR again' using errcode = '42501';
  end if;
  if p_device is distinct from t.device_id then
    raise exception 'ref key is in use on another device' using errcode = '42501';
  end if;
  if p_match.court_id is distinct from t.court_id then
    raise exception 'this match is not on your court' using errcode = '42501';
  end if;
  return 'ref:' || t.id::text;
end $$;

create or replace function public._log(m public.matches, p_kind text, p_actor text,
                                        p_rally_winner text default null,
                                        p_undoes bigint default null,
                                        p_note text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.match_events
    (match_id, kind, rally_winner, undoes_event_id, actor, note,
     score_a, score_b, serving_team, server_number, sides_switched)
  values
    (m.id, p_kind, p_rally_winner, p_undoes, p_actor, p_note,
     m.score_a, m.score_b, m.serving_team, m.server_number, m.sides_switched);
$$;

create or replace function public._save(m public.matches)
returns public.matches language sql security definer set search_path = '' as $$
  update public.matches set
    status = m.status, result_type = m.result_type,
    score_a = m.score_a, score_b = m.score_b,
    serving_team = m.serving_team, server_number = m.server_number,
    sides_switched = m.sides_switched, winner = m.winner,
    started_at = m.started_at, finished_at = m.finished_at,
    updated_at = now()
  where id = m.id
  returning *;
$$;

-- ---------------------------------------------------------------------
-- Referee: claim key (first scan of the QR)
-- ---------------------------------------------------------------------
create or replace function public.ref_claim(p_token text, p_pin text, p_device text)
returns table (court_id uuid, court_name text, tournament_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare t public.ref_tokens;
begin
  if p_device is null or length(p_device) < 16 then
    raise exception 'device id required';
  end if;
  select * into t from public.ref_tokens rt where rt.token_hash = public._sha256(p_token) for update;
  if not found or t.revoked or t.expires_at < now() then
    raise exception 'ref key invalid or expired' using errcode = '42501';
  end if;
  if t.pin_hash is not null
     and (p_pin is null or public._sha256(t.id::text || ':' || p_pin) <> t.pin_hash) then
    raise exception 'wrong PIN' using errcode = '42501';
  end if;
  if t.device_id is not null and t.device_id <> p_device then
    raise exception 'ref key already used on another device — ask the organizer to reissue it'
      using errcode = '42501';
  end if;
  update public.ref_tokens rt set device_id = p_device where rt.id = t.id;
  return query
    select c.id, c.name, c.tournament_id, t.expires_at
    from public.courts c where c.id = t.court_id;
end $$;

-- ---------------------------------------------------------------------
-- Scoring (ref with key, or organizer)
-- ---------------------------------------------------------------------
-- Start: first serving team begins at server 2 ("0-0-2").
create or replace function public.score_start(p_match_id bigint, p_first_serve text,
                                              p_token text default null, p_device text default null)
returns public.matches language plpgsql security definer set search_path = '' as $$
declare m public.matches; v_actor text;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found'; end if;
  v_actor := public._authorize_scoring(m, p_token, p_device);
  if m.status not in ('scheduled', 'called') then
    raise exception 'match already started (status: %)', m.status;
  end if;
  if m.team_a_id is null or m.team_b_id is null then
    raise exception 'both teams must be set before starting';
  end if;
  if p_first_serve not in ('A', 'B') then raise exception 'first serve must be A or B'; end if;

  m.status := 'live'; m.result_type := 'normal';
  m.score_a := 0; m.score_b := 0;
  m.serving_team := p_first_serve; m.server_number := 2;
  m.sides_switched := false; m.winner := null;
  m.started_at := now(); m.finished_at := null;
  m := public._save(m);
  perform public._log(m, 'start', v_actor);
  return m;
end $$;

-- One rally. Traditional side-out scoring for doubles.
create or replace function public.score_rally(p_match_id bigint, p_winner text,
                                              p_token text default null, p_device text default null)
returns public.matches language plpgsql security definer set search_path = '' as $$
declare m public.matches; v_actor text;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found'; end if;
  v_actor := public._authorize_scoring(m, p_token, p_device);
  if m.status <> 'live' then raise exception 'match is not live (status: %)', m.status; end if;
  if p_winner not in ('A', 'B') then raise exception 'winner must be A or B'; end if;

  if p_winner = m.serving_team then
    -- serving team wins the rally → point
    if p_winner = 'A' then m.score_a := m.score_a + 1; else m.score_b := m.score_b + 1; end if;
  elsif m.server_number = 1 then
    m.server_number := 2;                         -- partner serves
  else
    m.serving_team := p_winner; m.server_number := 1;   -- side out
  end if;

  -- switch ends when a team first reaches half the target (6 of 11, 8 of 15)
  if not m.sides_switched and greatest(m.score_a, m.score_b) >= ceil(m.points_to / 2.0) then
    m.sides_switched := true;
  end if;

  if public._is_game_won(m.score_a, m.score_b, m.points_to, m.win_by, m.cap) then
    m.status := 'finished';
    m.winner := case when m.score_a > m.score_b then 'A' else 'B' end;
    m.finished_at := now();
  end if;

  m := public._save(m);
  perform public._log(m, 'rally', v_actor, p_winner);
  return m;
end $$;

-- Undo last rally (also reopens a finished, unconfirmed match).
create or replace function public.score_undo(p_match_id bigint,
                                             p_token text default null, p_device text default null)
returns public.matches language plpgsql security definer set search_path = '' as $$
declare m public.matches; v_actor text; v_anchor bigint;
        last_e public.match_events; prev_e public.match_events;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found'; end if;
  v_actor := public._authorize_scoring(m, p_token, p_device);
  if m.status not in ('live', 'finished') or m.result_type <> 'normal' then
    raise exception 'cannot undo (status: %, result: %)', m.status, m.result_type;
  end if;

  -- undo never crosses a start or an organizer override
  select coalesce(max(e.id), 0) into v_anchor from public.match_events e
   where e.match_id = m.id and e.kind in ('start', 'override');

  select e.* into last_e from public.match_events e
   where e.match_id = m.id and e.kind = 'rally' and e.id > v_anchor
     and not exists (select 1 from public.match_events u where u.undoes_event_id = e.id)
   order by e.id desc limit 1;
  if not found then raise exception 'nothing to undo'; end if;

  select e.* into prev_e from public.match_events e
   where e.match_id = m.id and e.id < last_e.id and e.id >= v_anchor
     and (e.id = v_anchor
          or (e.kind = 'rally'
              and not exists (select 1 from public.match_events u where u.undoes_event_id = e.id)))
   order by e.id desc limit 1;

  m.score_a := prev_e.score_a; m.score_b := prev_e.score_b;
  m.serving_team := prev_e.serving_team; m.server_number := prev_e.server_number;
  m.sides_switched := prev_e.sides_switched;
  m.status := 'live'; m.winner := null; m.finished_at := null;
  m := public._save(m);
  perform public._log(m, 'undo', v_actor, null, last_e.id);
  return m;
end $$;

-- Forfeit / no-show: winner gets points_to : 0.
-- Retired: loser keeps their points, winner is raised to points_to if lower.
create or replace function public.score_special_result(p_match_id bigint, p_result text, p_winner text,
                                                       p_token text default null, p_device text default null)
returns public.matches language plpgsql security definer set search_path = '' as $$
declare m public.matches; v_actor text;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found'; end if;
  v_actor := public._authorize_scoring(m, p_token, p_device);
  if m.status not in ('scheduled', 'called', 'live') then
    raise exception 'match already ended (status: %)', m.status;
  end if;
  if p_result not in ('forfeit', 'retired', 'no_show') then raise exception 'bad result type'; end if;
  if p_winner not in ('A', 'B') then raise exception 'winner must be A or B'; end if;

  if p_result in ('forfeit', 'no_show') then
    m.score_a := case when p_winner = 'A' then m.points_to else 0 end;
    m.score_b := case when p_winner = 'B' then m.points_to else 0 end;
  elsif p_winner = 'A' then
    m.score_a := greatest(m.score_a, m.points_to);
  else
    m.score_b := greatest(m.score_b, m.points_to);
  end if;
  m.result_type := p_result; m.winner := p_winner;
  m.status := 'finished'; m.finished_at := now();
  m := public._save(m);
  perform public._log(m, 'special', v_actor, null, null, p_result);
  return m;
end $$;

-- ---------------------------------------------------------------------
-- Organizer only
-- ---------------------------------------------------------------------
create or replace function public._require_org(p_tournament uuid)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_organizer(p_tournament) then
    raise exception 'organizer only' using errcode = '42501';
  end if;
  return 'org:' || auth.uid()::text;
end $$;

-- Returns the plain key ONCE (put it in the QR). Only its hash is stored.
create or replace function public.org_create_ref_token(p_court uuid, p_pin text default null,
                                                       p_hours int default 18, p_label text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare c public.courts; v_token text; v_id uuid := gen_random_uuid();
begin
  select * into c from public.courts where id = p_court;
  if not found then raise exception 'court not found'; end if;
  perform public._require_org(c.tournament_id);
  if p_pin is not null and p_pin !~ '^[0-9]{4,6}$' then raise exception 'PIN must be 4–6 digits'; end if;
  v_token := encode(extensions.gen_random_bytes(16), 'hex');
  insert into public.ref_tokens (id, tournament_id, court_id, label, token_hash, pin_hash, expires_at)
  values (v_id, c.tournament_id, c.id, p_label, public._sha256(v_token),
          case when p_pin is null then null else public._sha256(v_id::text || ':' || p_pin) end,
          now() + make_interval(hours => p_hours));
  return v_token;
end $$;

create or replace function public.org_revoke_ref_token(p_token_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.ref_tokens;
begin
  select * into t from public.ref_tokens where id = p_token_id;
  if not found then raise exception 'ref key not found'; end if;
  perform public._require_org(t.tournament_id);
  update public.ref_tokens set revoked = true where id = p_token_id;
end $$;

-- Manual score fix (logged with reason). Not allowed on confirmed matches: reopen first.
create or replace function public.org_set_score(p_match_id bigint, p_score_a int, p_score_b int, p_reason text)
returns public.matches language plpgsql security definer set search_path = '' as $$
declare m public.matches; v_actor text;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found'; end if;
  v_actor := public._require_org(m.tournament_id);
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason required'; end if;
  if m.status = 'confirmed' then raise exception 'match is confirmed — reopen it first'; end if;
  if p_score_a < 0 or p_score_b < 0 then raise exception 'scores must be >= 0'; end if;

  m.score_a := p_score_a; m.score_b := p_score_b;
  if m.status in ('scheduled', 'called') then
    m.status := 'live'; m.started_at := coalesce(m.started_at, now());
  end if;
  if public._is_game_won(m.score_a, m.score_b, m.points_to, m.win_by, m.cap) then
    m.status := 'finished';
    m.winner := case when m.score_a > m.score_b then 'A' else 'B' end;
    m.finished_at := now();
  else
    m.status := 'live'; m.winner := null; m.finished_at := null;
    if m.serving_team is null then m.serving_team := 'A'; m.server_number := 1; end if;
  end if;
  m.result_type := 'normal';
  m := public._save(m);
  perform public._log(m, 'override', v_actor, null, null, p_reason);
  return m;
end $$;

-- Lock the result and push winner/loser into the next match slots ('W:<id>' / 'L:<id>').
create or replace function public.org_confirm_match(p_match_id bigint)
returns public.matches language plpgsql security definer set search_path = '' as $$
declare m public.matches; v_actor text; v_win uuid; v_lose uuid;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found'; end if;
  v_actor := public._require_org(m.tournament_id);
  if m.status <> 'finished' then raise exception 'only finished matches can be confirmed'; end if;

  m.status := 'confirmed';
  m := public._save(m);
  perform public._log(m, 'confirm', v_actor);

  v_win  := case when m.winner = 'A' then m.team_a_id else m.team_b_id end;
  v_lose := case when m.winner = 'A' then m.team_b_id else m.team_a_id end;
  update public.matches set team_a_id = v_win,  updated_at = now() where slot_a = 'W:' || m.id;
  update public.matches set team_b_id = v_win,  updated_at = now() where slot_b = 'W:' || m.id;
  update public.matches set team_a_id = v_lose, updated_at = now() where slot_a = 'L:' || m.id;
  update public.matches set team_b_id = v_lose, updated_at = now() where slot_b = 'L:' || m.id;
  return m;
end $$;

-- Unlock a confirmed match (blocked if a later match fed by it already started).
create or replace function public.org_reopen_match(p_match_id bigint, p_reason text)
returns public.matches language plpgsql security definer set search_path = '' as $$
declare m public.matches; v_actor text;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found'; end if;
  v_actor := public._require_org(m.tournament_id);
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason required'; end if;
  if m.status <> 'confirmed' then raise exception 'match is not confirmed'; end if;
  if exists (select 1 from public.matches d
             where (d.slot_a in ('W:' || m.id, 'L:' || m.id) or d.slot_b in ('W:' || m.id, 'L:' || m.id))
               and d.status not in ('scheduled', 'called')) then
    raise exception 'a later match fed by this one has already started';
  end if;
  update public.matches set team_a_id = null, updated_at = now() where slot_a in ('W:' || m.id, 'L:' || m.id);
  update public.matches set team_b_id = null, updated_at = now() where slot_b in ('W:' || m.id, 'L:' || m.id);
  m.status := 'finished';
  m := public._save(m);
  perform public._log(m, 'reopen', v_actor, null, null, p_reason);
  return m;
end $$;

-- ---------------------------------------------------------------------
-- Standings (head-to-head tiebreak is applied in the app, Day 4)
-- Rank order: wins → point difference → head-to-head → organizer decides
-- ---------------------------------------------------------------------
create or replace view public.group_standings with (security_invoker = true) as
with res as (
  select m.group_id, m.team_a_id as team_id, m.score_a as pf, m.score_b as pa, (m.winner = 'A') as won
  from public.matches m
  where m.group_id is not null and m.status in ('finished', 'confirmed')
  union all
  select m.group_id, m.team_b_id, m.score_b, m.score_a, (m.winner = 'B')
  from public.matches m
  where m.group_id is not null and m.status in ('finished', 'confirmed')
)
select
  t.group_id,
  t.id                                   as team_id,
  t.name,
  count(r.team_id)                       as played,
  count(*) filter (where r.won)          as wins,
  count(*) filter (where r.won = false)  as losses,
  coalesce(sum(r.pf), 0)                 as points_for,
  coalesce(sum(r.pa), 0)                 as points_against,
  coalesce(sum(r.pf - r.pa), 0)          as point_diff,
  rank() over (partition by t.group_id
               order by count(*) filter (where r.won) desc,
                        coalesce(sum(r.pf - r.pa), 0) desc) as prelim_rank
from public.teams t
left join res r on r.team_id = t.id and r.group_id = t.group_id
where t.group_id is not null
group by t.group_id, t.id, t.name;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.tournaments  enable row level security;
alter table public.organizers   enable row level security;
alter table public.courts       enable row level security;
alter table public.stages       enable row level security;
alter table public.groups       enable row level security;
alter table public.teams        enable row level security;
alter table public.matches      enable row level security;
alter table public.match_events enable row level security;
alter table public.ref_tokens   enable row level security;

-- Public read (TV, players, refs)
create policy read_all on public.tournaments  for select using (true);
create policy read_all on public.courts       for select using (true);
create policy read_all on public.stages       for select using (true);
create policy read_all on public.groups       for select using (true);
create policy read_all on public.teams        for select using (true);
create policy read_all on public.matches      for select using (true);
create policy read_all on public.match_events for select using (true);

-- Tournaments: any logged-in user can create one (and becomes its organizer)
create policy create_t on public.tournaments for insert to authenticated with check (true);
create policy org_upd  on public.tournaments for update to authenticated
  using (public.is_organizer(id)) with check (public.is_organizer(id));
create policy org_del  on public.tournaments for delete to authenticated
  using (public.is_organizer(id));

-- Organizers: see own rows; an organizer can add/remove co-organizers
create policy self_read on public.organizers for select to authenticated
  using (user_id = auth.uid() or public.is_organizer(tournament_id));
create policy org_add on public.organizers for insert to authenticated
  with check (public.is_organizer(tournament_id));
create policy org_rm  on public.organizers for delete to authenticated
  using (public.is_organizer(tournament_id));

-- Setup tables: organizers of that tournament
create policy org_write on public.courts for all to authenticated
  using (public.is_organizer(tournament_id)) with check (public.is_organizer(tournament_id));
create policy org_write on public.stages for all to authenticated
  using (public.is_organizer(tournament_id)) with check (public.is_organizer(tournament_id));
create policy org_write on public.teams for all to authenticated
  using (public.is_organizer(tournament_id)) with check (public.is_organizer(tournament_id));
create policy org_write on public.groups for all to authenticated
  using (public.is_organizer((select s.tournament_id from public.stages s where s.id = stage_id)))
  with check (public.is_organizer((select s.tournament_id from public.stages s where s.id = stage_id)));
create policy org_write on public.matches for all to authenticated
  using (public.is_organizer(tournament_id)) with check (public.is_organizer(tournament_id));

-- Ref keys: organizers can list them (hashes only); creation/revocation via functions
create policy org_read on public.ref_tokens for select to authenticated
  using (public.is_organizer(tournament_id));

-- Column-level lock: organizers may edit scheduling fields directly,
-- but score/state columns change only through the functions above.
revoke insert, update, delete on public.match_events from anon, authenticated;
revoke all on public.ref_tokens from anon;
revoke insert, update, delete on public.ref_tokens from authenticated;
revoke update on public.matches from anon, authenticated;
grant update (stage_id, group_id, round, position, label, slot_a, slot_b, team_a_id, team_b_id,
              court_id, queue_order, status, points_to, win_by, cap)
  on public.matches to authenticated;
revoke insert, update, delete on public.tournaments, public.organizers, public.courts,
  public.stages, public.groups, public.teams, public.matches from anon;

-- Internal helpers are not callable from the API
revoke execute on function public._authorize_scoring(public.matches, text, text) from public, anon, authenticated;
revoke execute on function public._log(public.matches, text, text, text, bigint, text) from public, anon, authenticated;
revoke execute on function public._save(public.matches) from public, anon, authenticated;
revoke execute on function public._require_org(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Realtime: TV / player / organizer pages subscribe to these
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.matches, public.match_events;
