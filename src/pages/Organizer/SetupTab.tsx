import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SlugField } from '../../components/SlugField'
import { absUrl, adminPath, isValidSlug, pubPath, slugify, tvPath } from '../../lib/paths'
import { supabase } from '../../lib/supabase'
import { useT } from '../../lib/i18n'
import { useToast } from '../../components/Toast'
import type { TabProps } from '../../lib/useTournamentData'
import type { Stage, StageConfig } from '../../lib/types'
import { groupName, scheduleGroups, shuffle, snakeDistribute } from '../../lib/roundRobin'
import { parseTeamsTsv } from '../../lib/teamsTsv'
import { computeGroupStandings } from '../../lib/standings'
import { buildKnockout } from '../../lib/bracket'
import { insertBracket } from '../../lib/bracketDb'

const inp = 'input'
const btn = 'btn btn-secondary btn-sm'
const primary = 'btn btn-primary btn-sm'
const danger = 'btn btn-danger btn-sm'
const Section = ({ step, title, desc, children }: { step: number; title: string; desc: string; children: ReactNode }) => (
  <section className="card mb-5">
    <div className="flex items-start gap-3 border-b border-ink-100 px-5 py-4">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-900 text-xs font-bold text-white">{step}</span>
      <div><h2 className="section-title">{title}</h2><p className="muted text-sm">{desc}</p></div>
    </div>
    <div className="p-5">{children}</div>
  </section>
)

// Runs a DB action, throwing on supabase error; toasts verbatim message and reloads.
function useDb({ reload }: TabProps) {
  const toast = useToast()
  const check = <T extends { error: { message: string } | null }>(r: T): T => {
    if (r.error) throw new Error(r.error.message)
    return r
  }
  const run = async (fn: () => PromiseLike<unknown>) => {
    try { await fn(); await reload(); return true } catch (e) { toast.error((e as Error).message); return false }
  }
  return { run, check, toast }
}

function TournamentSection(p: TabProps) {
  const t = useT()
  const nav = useNavigate()
  const { slug: urlKey } = useParams()
  const { run, check, toast } = useDb(p)
  const tour = p.data.tournament
  const [name, setName] = useState(tour?.name ?? '')
  const [date, setDate] = useState(tour?.event_date ?? '')
  const [slug, setSlug] = useState(tour?.slug ?? slugify(tour?.name ?? ''))
  const tk = { id: p.tid, slug: tour?.slug ?? null }
  const publicUrl = absUrl(pubPath(tk))
  const save = async () => {
    if (slug && !isValidSlug(slug)) return toast.error(t('slugInvalid'))
    const ok = await run(async () => check(await supabase.from('tournaments')
      .update({ name, event_date: date || null, slug: slug || null }).eq('id', p.tid)))
    if (ok && (slug || p.tid) !== urlKey) nav(adminPath({ id: p.tid, slug: slug || null }), { replace: true })
  }
  return (
    <Section step={1} title={t('tournament')} desc={t('setupTournamentDesc')}>
      <div className="flex flex-wrap gap-2">
        <input className={`${inp} min-w-0 flex-1`} value={name} onChange={e => setName(e.target.value)} />
        <input className={`${inp} !w-auto`} type="date" value={date} onChange={e => setDate(e.target.value)} />
        <button className={primary} onClick={save}>{t('save')}</button>
      </div>
      <div className="mt-4 space-y-2">
        <SlugField value={slug} onChange={setSlug} />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="muted break-all">{publicUrl}</span>
          <button className={btn} onClick={() => navigator.clipboard.writeText(publicUrl).then(() => toast.info(t('copied')))}>{t('copy')}</button>
        </div>
        <div className="muted text-xs">{t('urlHints', { tv: absUrl(tvPath(tk)), court: absUrl(`${pubPath(tk)}/${t('courtUrlExample')}`) })}</div>
      </div>
    </Section>
  )
}

function CourtsSection(p: TabProps) {
  const t = useT()
  const { run, check } = useDb(p)
  const [name, setName] = useState('')
  const courts = p.data.courts
  const move = (i: number, d: -1 | 1) => run(async () => {
    const order = [...courts]
    ;[order[i], order[i + d]] = [order[i + d], order[i]]
    for (const [idx, c] of order.entries()) {
      if (c.sort !== idx) check(await supabase.from('courts').update({ sort: idx }).eq('id', c.id))
    }
  })
  return (
    <Section step={2} title={t('courts')} desc={t('setupCourtsDesc')}>
      {courts.map((c, i) => (
        <div key={c.id} className="mb-1 flex gap-2">
          <input className={inp} defaultValue={c.name}
            onBlur={e => e.target.value !== c.name && run(async () => check(await supabase.from('courts').update({ name: e.target.value }).eq('id', c.id)))} />
          <button className={btn} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
          <button className={btn} disabled={i === courts.length - 1} onClick={() => move(i, 1)}>↓</button>
          <button className={danger} onClick={() => window.confirm(t('confirmDelete')) && run(async () => check(await supabase.from('courts').delete().eq('id', c.id)))}>{t('delete')}</button>
        </div>
      ))}
      <form className="mt-2 flex gap-2" onSubmit={e => {
        e.preventDefault()
        run(async () => check(await supabase.from('courts').insert({ tournament_id: p.tid, name, sort: courts.length }))).then(ok => ok && setName(''))
      }}>
        <input className={inp} required placeholder={t('courtName')} value={name} onChange={e => setName(e.target.value)} />
        <button className={primary}>{t('add')}</button>
      </form>
    </Section>
  )
}

function TeamsSection(p: TabProps) {
  const t = useT()
  const { run, check } = useDb(p)
  const [f, setF] = useState({ name: '', player1: '', player2: '', seed: '' })
  const [paste, setPaste] = useState('')
  const parsed = paste.trim() ? parseTeamsTsv(paste) : null
  const rr = p.data.stages.find(s => s.kind === 'round_robin')
  const stageGroups = p.data.groups.filter(g => g.stage_id === rr?.id)
  const insert = (rows: { name: string; player1: string; player2: string; seed: number | null }[]) =>
    run(async () => check(await supabase.from('teams').insert(rows.map(r => ({ ...r, tournament_id: p.tid })))))

  return (
    <Section step={3} title={t('teams')} desc={t('setupTeamsDesc')}>
      <form className="mb-4 flex flex-wrap gap-2" onSubmit={e => {
        e.preventDefault()
        insert([{ name: f.name, player1: f.player1, player2: f.player2, seed: f.seed ? Number(f.seed) : null }])
          .then(ok => ok && setF({ name: '', player1: '', player2: '', seed: '' }))
      }}>
        <input className={inp} required placeholder={t('teamName')} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
        <input className={inp} required placeholder={t('player1')} value={f.player1} onChange={e => setF({ ...f, player1: e.target.value })} />
        <input className={inp} required placeholder={t('player2')} value={f.player2} onChange={e => setF({ ...f, player2: e.target.value })} />
        <input className={`${inp} !w-20`} type="number" placeholder={t('seed')} value={f.seed} onChange={e => setF({ ...f, seed: e.target.value })} />
        <button className={primary}>{t('add')}</button>
      </form>
      <div className="mb-3">
        <div className="label mb-1">{t('pasteHint')}</div>
        <textarea className={`${inp} h-32 font-mono text-xs`} value={paste} onChange={e => setPaste(e.target.value)} />
        {parsed && (
          <div className="text-sm">
            {t('pasteSummary', { ok: parsed.rows.length, bad: parsed.errors.length })}
            {parsed.errors.map(er => <div key={er.line} className="text-live">{er.line}: {er.text}</div>)}
            <button className={primary} disabled={!parsed.rows.length} onClick={() => insert(parsed.rows).then(ok => ok && setPaste(''))}>{t('importTeams')}</button>
          </div>
        )}
      </div>
      <table className="table-std mt-2">
        <tbody>
          {p.data.teams.map(tm => (
            <tr key={tm.id}>
              <td>{tm.seed ?? ''}</td><td>{tm.name}</td><td>{tm.player1} / {tm.player2}</td>
              <td>
                <select className={inp} value={tm.group_id ?? ''}
                  onChange={e => run(async () => check(await supabase.from('teams').update({ group_id: e.target.value || null }).eq('id', tm.id)))}>
                  <option value="">—</option>
                  {stageGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </td>
              <td><button className={danger} onClick={() => window.confirm(t('confirmDelete')) && run(async () => check(await supabase.from('teams').delete().eq('id', tm.id)))}>{t('delete')}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
}

function StageRow({ stage, p }: { stage: Stage; p: TabProps }) {
  const t = useT()
  const { run, check } = useDb(p)
  const [s, setS] = useState({ name: stage.name, points_to: String(stage.points_to), win_by: String(stage.win_by), cap: stage.cap === null ? '' : String(stage.cap) })
  const [topN, setTopN] = useState(String(stage.config.top_n ?? 2))
  const num = (k: 'points_to' | 'win_by' | 'cap') => (
    <input className={`${inp} !w-16`} type="number" value={s[k]} onChange={e => setS({ ...s, [k]: e.target.value })} />
  )
  const save = () => run(async () => check(await supabase.from('stages').update({
    name: s.name, points_to: Number(s.points_to), win_by: Number(s.win_by), cap: s.cap === '' ? null : Number(s.cap),
  }).eq('id', stage.id)))
  const saveTopN = () => run(async () => {
    const n = Number(topN)
    check(await supabase.from('stages').update({ config: { ...stage.config, top_n: n } }).eq('id', stage.id))
    const ks = p.data.stages.filter(x => x.kind === 'knockout' && x.config.source_stage_id === stage.id).sort((a, b) => a.sort - b.sort)
    for (const [i, k] of ks.entries()) {
      const cfg: StageConfig = i === 0 ? { ...k.config, rank_from: 1, rank_to: n } : { ...k.config, rank_from: n + 1, rank_to: null }
      if (i < 2) check(await supabase.from('stages').update({ config: cfg }).eq('id', k.id))
    }
  })
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
      <input className={inp} value={s.name} onChange={e => setS({ ...s, name: e.target.value })} />
      <span className="pill bg-ink-100 text-ink-700">{stage.kind}</span>
      {t('pointsTo')} {num('points_to')} {t('winBy')} {num('win_by')} {t('cap')} {num('cap')}
      <button className={btn} onClick={save}>{t('save')}</button>
      {stage.kind === 'round_robin' && (
        <>
          <span>{t('topN')}</span>
          <input className={`${inp} !w-16`} type="number" min={1} value={topN} onChange={e => setTopN(e.target.value)} />
          <button className={btn} onClick={saveTopN}>{t('save')}</button>
        </>
      )}
    </div>
  )
}

function StagesSection(p: TabProps) {
  const t = useT()
  const { run, check } = useDb(p)
  const [topN, setTopN] = useState('2')
  const create = () => run(async () => {
    const n = Number(topN)
    const base = { tournament_id: p.tid, points_to: 11, win_by: 2, cap: 15 }
    const rr = check(await supabase.from('stages').insert({ ...base, name: 'Vòng bảng', kind: 'round_robin', sort: 0, config: { top_n: n } }).select('id').single())
    const id = (rr.data as { id: string }).id
    check(await supabase.from('stages').insert([
      { ...base, name: 'Seria A', kind: 'knockout', sort: 1, config: { source_stage_id: id, rank_from: 1, rank_to: n } },
      { ...base, name: 'Seria B', kind: 'knockout', sort: 2, config: { source_stage_id: id, rank_from: n + 1, rank_to: null } },
    ]))
  })
  return (
    <Section step={4} title={t('stages')} desc={t('setupStagesDesc')}>
      {p.data.stages.length === 0 ? (
        <div className="flex items-center gap-2">
          <span>{t('topN')}</span>
          <input className={`${inp} !w-16`} type="number" min={1} value={topN} onChange={e => setTopN(e.target.value)} />
          <button className={primary} onClick={create}>{t('createDefaultStages')}</button>
        </div>
      ) : p.data.stages.map(s => <StageRow key={s.id} stage={s} p={p} />)}
    </Section>
  )
}

function GroupsSection(p: TabProps) {
  const t = useT()
  const { run, check, toast } = useDb(p)
  const { data } = p
  const rr = data.stages.find(s => s.kind === 'round_robin')
  const groups = data.groups.filter(g => g.stage_id === rr?.id)
  const [count, setCount] = useState(String(groups.length || 2))
  if (!rr) return null
  const kos = data.stages.filter(s => s.kind === 'knockout' && s.config.source_stage_id === rr.id)
  const involved = [rr.id, ...kos.map(k => k.id)]
  const started = data.matches.some(m => involved.includes(m.stage_id) && m.status !== 'scheduled')

  const distribute = (random: boolean) => {
    if (started) return toast.error(t('errStarted'))
    const n = Number(count)
    if (!(n >= 1) || !data.teams.length) return
    if (!window.confirm(t('confirmRegroup'))) return
    const sorted = random ? shuffle(data.teams) : [...data.teams].sort((a, b) =>
      (a.seed ?? 1e9) - (b.seed ?? 1e9) || a.name.localeCompare(b.name))
    const split = snakeDistribute(sorted, n)
    run(async () => {
      // knockout slots reference group ids, so their placeholder matches must go too
      check(await supabase.from('matches').delete().in('stage_id', involved))
      check(await supabase.from('groups').delete().eq('stage_id', rr.id))
      const ins = check(await supabase.from('groups').insert(split.map((_, i) => ({ stage_id: rr.id, name: groupName(i), sort: i }))).select('id,sort'))
      const ids = (ins.data as { id: string; sort: number }[]).sort((a, b) => a.sort - b.sort)
      for (const [i, grp] of split.entries()) {
        for (const tm of grp) check(await supabase.from('teams').update({ group_id: ids[i].id }).eq('id', tm.id))
      }
    })
  }

  const generate = () => {
    if (data.matches.some(m => m.stage_id === rr.id && m.status !== 'scheduled')) return toast.error(t('errStarted'))
    const existing = data.matches.some(m => m.stage_id === rr.id)
    if (existing && !window.confirm(t('confirmRegenerate'))) return
    const sched = scheduleGroups(groups.map(g => ({ groupId: g.id, teamIds: data.teams.filter(x => x.group_id === g.id).map(x => x.id) })))
    run(async () => {
      check(await supabase.from('matches').delete().eq('stage_id', rr.id))
      check(await supabase.from('matches').insert(sched.map(s => ({
        tournament_id: p.tid, stage_id: rr.id, group_id: s.groupId, round: s.round, position: s.position, label: s.label,
        queue_order: s.queueOrder, team_a_id: s.teamA, team_b_id: s.teamB,
      }))))
    })
  }

  return (
    <Section step={5} title={t('groupsMatches')} desc={t('setupGroupsDesc')}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input className={`${inp} !w-16`} type="number" min={1} value={count} onChange={e => setCount(e.target.value)} />
        <button className={btn} onClick={() => distribute(false)}>{t('autoDistribute')}</button>
        <button className={btn} onClick={() => distribute(true)}>{t('shuffle')}</button>
        <button className={primary} disabled={!groups.length} onClick={generate}>{t('generateMatches')}</button>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {groups.map(g => (
          <div key={g.id} className="rounded-md bg-ink-50 p-3">
            <b>{t('groupN', { name: g.name })}</b>
            {/* shortcut: select instead of drag, upgrade if organizers ask (see Teams table group select) */}
            <ul>{data.teams.filter(x => x.group_id === g.id).map(x => <li key={x.id}>{x.name}</li>)}</ul>
          </div>
        ))}
      </div>
    </Section>
  )
}

function AdvancementSection(p: TabProps) {
  const t = useT()
  const { run, check, toast } = useDb(p)
  const { data } = p
  const rr = data.stages.find(s => s.kind === 'round_robin')
  if (!rr) return null
  const kos = data.stages.filter(s => s.kind === 'knockout' && s.config.source_stage_id === rr.id).sort((a, b) => a.sort - b.sort)
  const groups = data.groups.filter(g => g.stage_id === rr.id)

  const maxQueue = async () => {
    const r = check(await supabase.from('matches').select('queue_order').eq('tournament_id', p.tid)
      .not('queue_order', 'is', null).order('queue_order', { ascending: false }).limit(1))
    return (r.data as { queue_order: number }[])[0]?.queue_order ?? 0
  }
  const build = async (closing: boolean) => {
    const rows = groups.map(g => {
      const ids = data.teams.filter(x => x.group_id === g.id).map(x => x.id)
      const ms = data.matches.filter(m => m.group_id === g.id)
      return { g, ids, ms, standings: computeGroupStandings(ids, ms, rr.config.manual_order?.[g.id]) }
    })
    if (data.matches.some(m => kos.some(k => k.id === m.stage_id) && m.status !== 'scheduled')) throw new Error(t('errStarted'))
    for (const k of kos) {
      check(await supabase.from('matches').delete().eq('stage_id', k.id))
      const from = k.config.rank_from ?? 1, to = k.config.rank_to ?? null
      const bracket = buildKnockout(
        rows.map(r => ({ groupId: r.g.id, ranked: closing ? r.standings.map(x => x.teamId) : r.ids.map(() => null) })),
        from, to, { pointsTo: k.points_to, winBy: k.win_by, cap: k.cap },
        closing ? rows.map(r => ({ groupId: r.g.id, rows: r.standings })) : undefined)
      await insertBracket(p.tid, k.id, bracket, await maxQueue())
    }
    if (closing) check(await supabase.from('stages').update({ config: { ...rr.config, closed: true } }).eq('id', rr.id))
  }

  const close = () => {
    for (const g of groups) {
      const ms = data.matches.filter(m => m.group_id === g.id)
      if (!ms.length || !ms.every(m => m.status === 'confirmed')) return toast.error(t('errNotAllConfirmed'))
      const st = computeGroupStandings(data.teams.filter(x => x.group_id === g.id).map(x => x.id), ms, rr.config.manual_order?.[g.id])
      if (st.some(r => r.needsDecision)) return toast.error(t('errNeedsDecision'))
    }
    if (!groups.length) return toast.error(t('errNotAllConfirmed'))
    run(() => build(true))
  }

  return (
    <Section step={6} title={t('advancement')} desc={t('setupAdvDesc')}>
      <div className="flex gap-2">
        <button className={btn} disabled={!kos.length || !groups.length || !!rr.config.closed} onClick={() => run(() => build(false))}>{t('generateBrackets')}</button>
        <button className={primary} disabled={!kos.length} onClick={close}>{t('closeGroupStage')}</button>
        {rr.config.closed && <span className="pill bg-brand-50 text-brand-700">{t('closed')}</span>}
      </div>
    </Section>
  )
}

export default function SetupTab(p: TabProps) {
  return (
    <div className="max-w-4xl">
      <TournamentSection {...p} />
      <CourtsSection {...p} />
      <TeamsSection {...p} />
      <StagesSection {...p} />
      <GroupsSection {...p} />
      <AdvancementSection {...p} />
    </div>
  )
}
