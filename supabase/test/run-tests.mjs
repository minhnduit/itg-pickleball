// Local test of schema.sql using PGlite (Postgres in WASM) with Supabase stubs.
// Run:  npm i @electric-sql/pglite && node run-tests.mjs ../schema.sql
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';

const schemaPath = process.argv[2] ?? new URL('../schema.sql', import.meta.url).pathname;
const db = new PGlite({ extensions: { pgcrypto } });

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } };
async function expectError(sql, params, match, msg) {
  try { await db.query(sql, params); ok(false, `${msg} (no error)`); }
  catch (e) { ok(!match || e.message.includes(match), `${msg} → "${e.message}"`); }
}
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];

const U1 = '11111111-1111-1111-1111-111111111111'; // organizer
const U2 = '22222222-2222-2222-2222-222222222222'; // random logged-in user
const DEV1 = 'device-aaaaaaaaaaaaaaaa';
const DEV2 = 'device-bbbbbbbbbbbbbbbb';

async function as(role, uid = null) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${role};`);
}

// ---- Supabase stubs ----
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth; create schema extensions;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public, extensions to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
  create publication supabase_realtime;
  insert into auth.users values ('${U1}'), ('${U2}');
`);
await db.exec(readFileSync(schemaPath, 'utf8'));
console.log('schema.sql applied');

// ---- Setup as organizer ----
console.log('\nSetup (organizer)');
await as('authenticated', U1);
const T = (await one(`insert into tournaments (name) values ('LSP Open') returning id`)).id;
ok((await one(`select count(*)::int n from organizers where tournament_id=$1`, [T])).n === 1, 'creator became organizer');
ok((await one(`update tournaments set slug='lsp-open' where id=$1 returning slug`, [T])).slug === 'lsp-open', 'organizer sets short link slug');
await expectError(`update tournaments set slug='Bad Slug!' where id=$1`, [T], 'check constraint', 'invalid slug rejected');
await expectError(`insert into tournaments (name, slug) values ('Other', 'lsp-open')`, [], 'unique', 'duplicate slug rejected');
const C1 = (await one(`insert into courts (tournament_id,name) values ($1,'Court 1') returning id`, [T])).id;
const C2 = (await one(`insert into courts (tournament_id,name) values ($1,'Court 2') returning id`, [T])).id;
const S = (await one(`insert into stages (tournament_id,name,kind,points_to,win_by,cap) values ($1,'Groups','round_robin',11,2,15) returning id`, [T])).id;
const SA = (await one(`insert into stages (tournament_id,name,kind,sort,points_to,win_by,cap) values ($1,'Series A','knockout',1,11,2,15) returning id`, [T])).id;
const G = (await one(`insert into groups (stage_id,name) values ($1,'A') returning id`, [S])).id;
const teams = [];
for (const n of ['Hổ', 'Báo', 'Sư Tử']) teams.push((await one(`insert into teams (tournament_id,name,player1,player2,group_id) values ($1,$2,'p1','p2',$3) returning id`, [T, n, G])).id);
const M1 = (await one(`insert into matches (stage_id,group_id,team_a_id,team_b_id,court_id,label) values ($1,$2,$3,$4,$5,'M1') returning *`, [S, G, teams[0], teams[1], C1]));
ok(M1.points_to === 11 && M1.win_by === 2 && M1.cap === 15 && M1.tournament_id === T, 'match copied rules 11 / win by 2 / cap 15 from stage');
const M2 = (await one(`insert into matches (stage_id,group_id,team_a_id,team_b_id,court_id,label) values ($1,$2,$3,$4,$5,'M2') returning id`, [S, G, teams[0], teams[2], C2])).id;
const SF = (await one(`insert into matches (stage_id,slot_a,slot_b,label,points_to,cap) values ($1,'W:${M1.id}','G:x:2','SF1',15,21) returning *`, [SA]));
ok(SF.points_to === 15 && SF.cap === 21, 'semi-final override 15 / cap 21');

const KEY = (await one(`select org_create_ref_token($1,'1234') k`, [C1])).k;
ok(/^[0-9a-f]{32}$/.test(KEY), 'ref key created (32 hex chars)');
const KEY2 = (await one(`select org_create_ref_token($1) k`, [C2])).k;

// ---- Random logged-in user cannot touch anything ----
console.log('\nNon-organizer logged-in user');
await as('authenticated', U2);
const upd = await db.query(`update teams set name='hacked' where tournament_id=$1`, [T]);
ok(upd.affectedRows === 0, 'cannot edit teams (0 rows)');
await expectError(`select org_create_ref_token($1)`, [C1], 'organizer only', 'cannot create ref key');
await expectError(`select score_rally($1,'A')`, [M1.id], 'not authorized', 'cannot score without key');
await expectError(`insert into organizers values ($1,$2)`, [T, U2], 'row-level security', 'cannot add self as organizer');

// ---- Anonymous public ----
console.log('\nAnonymous (players / TV / random phone)');
await as('anon');
ok((await db.query(`select * from matches`)).rows.length === 3, 'can read matches');
await expectError(`update matches set score_a = 99 where id=$1`, [M1.id], 'permission denied', 'cannot write score directly');
await expectError(`insert into match_events (match_id,kind,actor) values ($1,'rally','x')`, [M1.id], 'permission denied', 'cannot write events directly');
await expectError(`select * from ref_tokens`, [], 'permission denied', 'cannot read ref keys');
await expectError(`select _authorize_scoring(m, null, null) from matches m limit 1`, [], 'permission denied', 'cannot call internal helper');
await expectError(`select score_rally($1,'A','deadbeefdeadbeefdeadbeefdeadbeef',$2)`, [M1.id, DEV1], 'invalid', 'fake key rejected');

// ---- Referee key + PIN + device binding ----
console.log('\nReferee key');
await expectError(`select * from ref_claim($1,'0000',$2)`, [KEY, DEV1], 'wrong PIN', 'wrong PIN rejected');
const claim = await one(`select * from ref_claim($1,'1234',$2)`, [KEY, DEV1]);
ok(claim.court_name === 'Court 1', 'claim with PIN → Court 1');
ok((await one(`select court_name from ref_claim($1,'1234',$2)`, [KEY, DEV1])).court_name === 'Court 1', 're-claim on same device ok');
await expectError(`select * from ref_claim($1,'1234',$2)`, [KEY, DEV2], 'another device', 'second device blocked');
await expectError(`select score_start($1,'A',$2,$3)`, [M1.id, KEY, DEV2], 'another device', 'scoring from other device blocked');
await expectError(`select score_start($1,'A',$2,$3)`, [M2, KEY, DEV1], 'not on your court', 'cannot score match on Court 2');

// ---- Side-out scoring ----
console.log('\nSide-out scoring (0-0-2 start)');
const R = async (w) => one(`select * from score_rally($1,$2,$3,$4)`, [M1.id, w, KEY, DEV1]);
const U = async () => one(`select * from score_undo($1,$2,$3)`, [M1.id, KEY, DEV1]);
const st = (m) => `${m.score_a}-${m.score_b} srv ${m.serving_team}${m.server_number} ${m.status}`;
let m = await one(`select * from score_start($1,'A',$2,$3)`, [M1.id, KEY, DEV1]);
ok(st(m) === '0-0 srv A2 live', `start → ${st(m)}`);
m = await R('A'); ok(st(m) === '1-0 srv A2 live', `A wins rally → ${st(m)}`);
m = await R('B'); ok(st(m) === '1-0 srv B1 live', `B wins (server 2 lost) → side out ${st(m)}`);
m = await R('A'); ok(st(m) === '1-0 srv B2 live', `A wins → B partner serves ${st(m)}`);
m = await R('B'); ok(st(m) === '1-1 srv B2 live', `B wins → point ${st(m)}`);
m = await R('A'); ok(st(m) === '1-1 srv A1 live', `A wins → side out ${st(m)}`);

console.log('\nUndo');
m = await U(); ok(st(m) === '1-1 srv B2 live', `undo side out → ${st(m)}`);
m = await U(); ok(st(m) === '1-0 srv B2 live', `undo point → ${st(m)}`);
m = await R('B'); ok(st(m) === '1-1 srv B2 live', `replay → ${st(m)}`);
m = await U(); m = await U(); m = await U(); m = await U();
ok(st(m) === '0-0 srv A2 live', `undo back to start → ${st(m)}`);
await expectError(`select score_undo($1,$2,$3)`, [M1.id, KEY, DEV1], 'nothing to undo', 'cannot undo past start');

console.log('\nSide switch at 6');
for (let i = 0; i < 5; i++) m = await R('A');
ok(m.score_a === 5 && !m.sides_switched, '5-0 no switch yet');
m = await R('A'); ok(m.score_a === 6 && m.sides_switched, '6-0 → switch sides');
m = await U(); ok(!m.sides_switched, 'undo → switch flag cleared');

console.log('\nWin by 2, cap 15 (organizer override to set up)');
await as('authenticated', U1);
m = await one(`select * from org_set_score($1,10,10,'test setup')`, [M1.id]);
await as('anon');
// serving team after override: kept from before (A)
m = await R(m.serving_team);
const leader = m.score_a > m.score_b ? 'A' : 'B';
ok(m.status === 'live' && Math.max(m.score_a, m.score_b) === 11, `11-10 not finished → ${st(m)}`);
m = await R(leader); ok(m.status === 'finished' && m.winner === leader, `12-10 finished → ${st(m)} winner ${m.winner}`);
m = await U(); ok(m.status === 'live' && m.winner === null, `undo reopens → ${st(m)}`);
m = await U(); ok(m.score_a === 10 && m.score_b === 10, `undo to override point → ${st(m)}`);
await expectError(`select score_undo($1,$2,$3)`, [M1.id, KEY, DEV1], 'nothing to undo', 'undo cannot cross organizer override');
await as('authenticated', U1);
m = await one(`select * from org_set_score($1,14,14,'test cap')`, [M1.id]);
await as('anon');
m = await R(m.serving_team);
ok(m.status === 'finished' && Math.max(m.score_a, m.score_b) === 15, `14-14 → next point wins at cap → ${st(m)}`);

console.log('\nWin by 1 option');
await as('authenticated', U1);
await db.query(`update matches set win_by = 1, cap = null where id=$1`, [M2]);
await expectError(`update matches set score_a = 5 where id=$1`, [M2], 'permission denied', 'organizer cannot set score column directly either');
m = await one(`select * from score_start($1,'A')`, [M2]);
m = await one(`select * from org_set_score($1,10,10,'setup')`, [M2]);
m = await one(`select * from score_rally($1,$2)`, [M2, m.serving_team]);
ok(m.status === 'finished', `win_by=1: 11-10 finishes → ${st(m)}`);

console.log('\nConfirm, lock, advance');
await as('anon');
await expectError(`select org_confirm_match($1)`, [M1.id], 'organizer only', 'ref/anon cannot confirm');
await as('authenticated', U1);
m = await one(`select * from org_confirm_match($1)`, [M1.id]);
ok(m.status === 'confirmed', 'organizer confirmed M1');
const winTeam = m.winner === 'A' ? m.team_a_id : m.team_b_id;
ok((await one(`select team_a_id from matches where id=$1`, [SF.id])).team_a_id === winTeam, 'winner moved into SF1 slot');
await as('anon');
await expectError(`select score_undo($1,$2,$3)`, [M1.id, KEY, DEV1], 'cannot undo', 'ref cannot undo a confirmed match');
await as('authenticated', U1);
await expectError(`select org_set_score($1,0,0,'x')`, [M1.id], 'reopen it first', 'override blocked on confirmed');
m = await one(`select * from org_reopen_match($1,'dispute')`, [M1.id]);
ok(m.status === 'finished' && (await one(`select team_a_id from matches where id=$1`, [SF.id])).team_a_id === null, 'reopen → finished, SF1 slot cleared');

console.log('\nForfeit + revoke');
const M3 = (await one(`insert into matches (stage_id,group_id,team_a_id,team_b_id,court_id) values ($1,$2,$3,$4,$5) returning id`, [S, G, teams[1], teams[2], C1])).id;
await as('anon');
m = await one(`select * from score_special_result($1,'no_show','B',$2,$3)`, [M3, KEY, DEV1]);
ok(m.status === 'finished' && m.score_b === 11 && m.score_a === 0 && m.result_type === 'no_show', `no-show → ${m.score_a}-${m.score_b}`);
await as('authenticated', U1);
const tokId = (await one(`select id from ref_tokens where court_id=$1`, [C1])).id;
await db.query(`select org_revoke_ref_token($1)`, [tokId]);
await as('anon');
await expectError(`select score_undo($1,$2,$3)`, [M3, KEY, DEV1], 'invalid or expired', 'revoked key stops working');

console.log('\nStandings view');
const rows = (await db.query(`select name, played, wins, losses, point_diff, prelim_rank from group_standings order by prelim_rank, name`)).rows;
console.table(rows);
ok(rows.length === 3 && rows.reduce((s, r) => s + r.played, 0) === 6, 'standings counts 3 finished matches (6 team-results)');

console.log('\nAudit log for M1');
const ev = (await db.query(`select kind, rally_winner, actor like 'ref:%' as by_ref, note, score_a||'-'||score_b as score from match_events where match_id=$1 order by id`, [M1.id])).rows;
ok(ev.length > 20 && ev.some(e => e.kind === 'override' && e.note === 'test setup'), `${ev.length} events logged, overrides carry reason`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
