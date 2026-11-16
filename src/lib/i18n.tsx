import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

const vi = {
  appTitle: 'Giải Pickleball', home: 'Trang chủ', public: 'Công khai', organizer: 'Ban tổ chức',
  login: 'Đăng nhập', logout: 'Đăng xuất', email: 'Email', password: 'Mật khẩu',
  loading: 'Đang tải...', notOrganizer: 'Bạn không phải ban tổ chức của giải này',
  tournament: 'Giải đấu', tournamentName: 'Tên giải đấu', createTournament: 'Tạo giải đấu',
  newQr: 'Hãy nhờ ban tổ chức cấp mã QR mới', enterPin: 'Nhập mã PIN', continue: 'Tiếp tục',
  noMatchOnCourt: 'Chưa có trận nào được xếp cho sân này', nextMatch: 'Trận tiếp theo trên sân này',
  noMatch: 'Không tìm thấy trận đấu', back: 'Quay lại',
  // scoring
  whoServesFirst: 'Đội nào giao bóng trước?', rallyWon: '{team} thắng rally', undo: 'Hoàn tác',
  switchSides: 'ĐỔI SÂN', serving: 'Đang giao bóng', waitingConfirm: 'Chờ ban tổ chức xác nhận',
  pickWinner: 'Đội thắng:', cancel: 'Hủy',
  confirmSpecial: 'Xác nhận {result}: {team} thắng?',
  res_normal: 'Bình thường', res_forfeit: 'Bỏ cuộc', res_retired: 'Rút lui', res_no_show: 'Vắng mặt',
  st_scheduled: 'Chưa đấu', st_called: 'Đã gọi', st_live: 'Đang đấu', st_finished: 'Đã xong', st_confirmed: 'Đã xác nhận',
  // tabs
  tab_courts: 'Bảng sân', tab_matches: 'Trận đấu', tab_setup: 'Thiết lập', tab_standings: 'Xếp hạng & Nhánh đấu', tab_referees: 'Trọng tài',
  pub_live: 'Trực tiếp', pub_schedule: 'Lịch đấu', pub_groups: 'Bảng đấu', pub_brackets: 'Nhánh đấu',
  searchPlaceholder: 'Tìm tên đội / vận động viên', myMatches: 'Trận của tôi', nothingFound: 'Không tìm thấy',
  lastResults: 'Kết quả gần nhất',
  // courts board / matches
  tvView_courts: 'Sân đang đấu', tvView_standings: 'Bảng xếp hạng', tvView_brackets: 'Nhánh đấu', tvView_upnext: 'Trận tiếp theo', tvPaused: 'Tạm dừng',
  idle: 'Sân trống', noCurrent: 'Chưa có trận', next: 'Tiếp theo', callNext: 'Gọi trận tiếp', uncall: 'Hủy gọi', courtQueue: 'Hàng chờ', moveUp: 'Lên', moveDown: 'Xuống', playNext: 'Đánh trước', delay: 'Hoãn', unassign: 'Bỏ khỏi sân', assignMatch: 'Xếp trận...',
  takeOver: 'Chấm điểm thay', override: 'Sửa điểm', reason: 'Lý do', save: 'Lưu',
  allStages: 'Tất cả giai đoạn', allGroups: 'Tất cả bảng', allStatuses: 'Mọi trạng thái', allCourts: 'Tất cả sân', noCourt: 'Chưa có sân',
  confirmAllFinished: 'Xác nhận tất cả trận đã xong', match: 'Trận', court: 'Sân', status: 'Trạng thái', score: 'Điểm',
  call: 'Gọi', confirm: 'Xác nhận', reopen: 'Mở lại', log: 'Nhật ký',
  // setup
  courts: 'Sân', courtName: 'Tên sân', add: 'Thêm', delete: 'Xóa', confirmDelete: 'Xóa mục này?',
  teams: 'Đội', team: 'Đội', teamName: 'Tên đội', player1: 'VĐV 1', player2: 'VĐV 2', seed: 'Hạt giống',
  pasteHint: 'Dán từ Excel: Tên đội | VĐV 1 | VĐV 2 | Hạt giống (phân tách bằng Tab)',
  pasteSummary: '{ok} đội hợp lệ, {bad} dòng lỗi', importTeams: 'Nhập các đội',
  stages: 'Giai đoạn', groupStage: 'Vòng bảng', topN: 'Top N mỗi bảng', createDefaultStages: 'Tạo giai đoạn mặc định',
  pointsTo: 'Tới', winBy: 'Hơn', cap: 'Chạm',
  groups: 'Bảng', autoDistribute: 'Chia tự động (theo hạt giống)', shuffle: 'Xáo trộn', generateMatches: 'Tạo trận vòng bảng',
  errStarted: 'Đã có trận bắt đầu, không thể thay đổi',
  confirmRegroup: 'Chia lại bảng sẽ xóa các trận hiện có. Tiếp tục?',
  confirmRegenerate: 'Sẽ xóa các trận vòng bảng hiện có. Tiếp tục?',
  advancement: 'Vào vòng trong', generateBrackets: 'Tạo nhánh đấu (xem trước)', closeGroupStage: 'Kết thúc vòng bảng', closed: 'Đã kết thúc vòng bảng',
  errNotAllConfirmed: 'Mọi trận vòng bảng phải được xác nhận trước',
  errNeedsDecision: 'Còn đội đồng hạng cần ban tổ chức quyết định thứ tự',
  // standings
  colPShort: 'Tr', colWShort: 'T', colLShort: 'B', colP: 'Trận', colW: 'Thắng', colL: 'Thua', colPF: 'Ghi', colPA: 'Thủng',
  tbH2h: 'Đối đầu', tbManual: 'Bốc thăm', tbNeedsDecision: 'Cần bốc thăm',
  saveOrder: 'Lưu thứ tự', clearManual: 'Xóa thứ tự thủ công', noBracket: 'Chưa có nhánh đấu',
  slotGroupRank: '{rank} {group}', slotWinner: 'Thắng {label}',
  // referees tab
  vs: 'gặp', tv: 'TV', diffCol: '+/-', pinLabel: 'PIN: {pin}', retry: 'Thử lại',
  ev_start: 'bắt đầu', ev_rally: 'rally', ev_undo: 'hoàn tác', ev_special: 'kết quả đặc biệt', ev_override: 'sửa điểm', ev_confirm: 'xác nhận', ev_reopen: 'mở lại',
  pinOptional: 'PIN (tùy chọn)', hours: 'Giờ', label: 'Nhãn', createKey: 'Tạo mã', revoke: 'Thu hồi',
  tokRevoked: 'Đã thu hồi', tokExpired: 'Hết hạn', tokClaimed: 'Đã dùng', tokNotClaimed: 'Chưa dùng',
  shownOnce: 'Mã chỉ hiển thị một lần', refQrSubtitle: 'Quét để chấm điểm', print: 'In', printCourtQrs: 'In QR các sân',
  rank_1: 'Nhất', rank_2: 'Nhì', rank_3: 'Ba', rank_4: 'Tư', rankN: 'Hạng {n}',
  notFound: 'Không tìm thấy trang này', shortLink: 'Đường dẫn ngắn', slugInvalid: 'Chỉ dùng chữ thường, số và dấu gạch ngang (2–40 ký tự)', copy: 'Sao chép', copied: 'Đã sao chép',
  urlHints: 'TV: {tv} · Sân: {court}', courtUrlExample: 'san-1',
  printIdNote: 'Mã QR in dùng ID cố định nên vẫn hoạt động khi đổi tên sân hoặc đường dẫn.',
  date: 'Ngày', wordmark: 'Pickleball', tournaments: 'Giải đấu', tournamentsSub: 'Chọn giải để xem lịch đấu và tỉ số trực tiếp', noTournaments: 'Chưa có giải đấu nào',
  eyebrowCourt: 'Sân', eyebrowRef: 'Trọng tài', scoreCallHint: 'điểm giao – điểm nhận – người giao', rallyWonShort: 'thắng rally',
  round_final: 'Chung kết', round_sf: 'Bán kết', round_qf: 'Tứ kết', round_n: 'Vòng {n}',
  idleFor: 'Trống {min} phút', server: 'Người giao', upNext: 'Sắp diễn ra', groupN: 'Bảng {name}', myMatchesCount: '{n} trận',
  setupTournamentDesc: 'Tên và ngày diễn ra giải đấu.', setupCourtsDesc: 'Thêm, đổi tên và sắp xếp thứ tự các sân.',
  setupTeamsDesc: 'Thêm từng đội hoặc dán danh sách từ Excel.', setupStagesDesc: 'Vòng bảng và các series loại trực tiếp, cùng luật chơi.',
  setupGroupsDesc: 'Chia bảng rồi tạo lịch các trận vòng bảng.', setupAdvDesc: 'Tạo nhánh đấu và kết thúc vòng bảng.',
  sectionCount: '{n} trận', sec_now: 'Đang đấu', sec_upcoming: 'Sắp tới', sec_done: 'Đã xong', sec_noCourt: 'Chưa xếp sân',
  by_order: 'Thứ tự', by_court: 'Theo sân', by_team: 'Theo đội', by_group: 'Theo bảng',
  f_court: 'Sân', f_team: 'Đội', f_group: 'Bảng / vòng', all: 'Tất cả', clearFilters: 'Xóa lọc',
  groupsMatches: 'Bảng đấu & trận', activeKeys: '{n} mã đang hoạt động', navMenu: 'Menu',
} as const

type Key = keyof typeof vi

const en: Record<Key, string> = {
  appTitle: 'Pickleball Tournament', home: 'Home', public: 'Public', organizer: 'Organizer',
  login: 'Log in', logout: 'Log out', email: 'Email', password: 'Password',
  loading: 'Loading...', notOrganizer: 'You are not an organizer of this tournament',
  tournament: 'Tournament', tournamentName: 'Tournament name', createTournament: 'Create tournament',
  newQr: 'Ask the organizer for a new QR', enterPin: 'Enter PIN', continue: 'Continue',
  noMatchOnCourt: 'No match assigned to this court yet', nextMatch: 'Next match on this court',
  noMatch: 'Match not found', back: 'Back',
  whoServesFirst: 'Who serves first?', rallyWon: '{team} wins rally', undo: 'Undo',
  switchSides: 'SWITCH SIDES', serving: 'Serving', waitingConfirm: 'Waiting for organizer confirmation',
  pickWinner: 'Winner:', cancel: 'Cancel',
  confirmSpecial: 'Confirm {result}: {team} wins?',
  res_normal: 'Normal', res_forfeit: 'Forfeit', res_retired: 'Retired', res_no_show: 'No-show',
  st_scheduled: 'Scheduled', st_called: 'Called', st_live: 'Live', st_finished: 'Finished', st_confirmed: 'Confirmed',
  tab_courts: 'Courts', tab_matches: 'Matches', tab_setup: 'Setup', tab_standings: 'Standings & Brackets', tab_referees: 'Referees',
  pub_live: 'Live', pub_schedule: 'Schedule', pub_groups: 'Groups', pub_brackets: 'Brackets',
  searchPlaceholder: 'Search team / player', myMatches: 'My matches', nothingFound: 'Nothing found',
  lastResults: 'Last results',
  tvView_courts: 'Live courts', tvView_standings: 'Standings', tvView_brackets: 'Brackets', tvView_upnext: 'Up next', tvPaused: 'Paused',
  idle: 'Idle', noCurrent: 'No match', next: 'Next', callNext: 'Call next', uncall: 'Cancel call', courtQueue: 'Queue', moveUp: 'Move up', moveDown: 'Move down', playNext: 'Play next', delay: 'Delay', unassign: 'Remove from court', assignMatch: 'Assign match...',
  takeOver: 'Take over scoring', override: 'Override score', reason: 'Reason', save: 'Save',
  allStages: 'All stages', allGroups: 'All groups', allStatuses: 'All statuses', allCourts: 'All courts', noCourt: 'No court',
  confirmAllFinished: 'Confirm all finished', match: 'Match', court: 'Court', status: 'Status', score: 'Score',
  call: 'Call', confirm: 'Confirm', reopen: 'Reopen', log: 'Log',
  courts: 'Courts', courtName: 'Court name', add: 'Add', delete: 'Delete', confirmDelete: 'Delete this item?',
  teams: 'Teams', team: 'Team', teamName: 'Team name', player1: 'Player 1', player2: 'Player 2', seed: 'Seed',
  pasteHint: 'Paste from Excel: Team name | Player 1 | Player 2 | Seed (tab-separated)',
  pasteSummary: '{ok} valid teams, {bad} bad lines', importTeams: 'Import teams',
  stages: 'Stages', groupStage: 'Group stage', topN: 'Top N per group', createDefaultStages: 'Create default stages',
  pointsTo: 'To', winBy: 'Win by', cap: 'Cap',
  groups: 'Groups', autoDistribute: 'Auto distribute (by seed)', shuffle: 'Shuffle', generateMatches: 'Generate group matches',
  errStarted: 'Matches have already started, cannot change',
  confirmRegroup: 'Regrouping deletes the existing matches. Continue?',
  confirmRegenerate: 'This deletes the existing group matches. Continue?',
  advancement: 'Advancement', generateBrackets: 'Generate brackets (preview)', closeGroupStage: 'Close group stage', closed: 'Group stage closed',
  errNotAllConfirmed: 'Every group match must be confirmed first',
  errNeedsDecision: 'Some tied teams need a manual order decision',
  colPShort: 'P', colWShort: 'W', colLShort: 'L', colP: 'P', colW: 'W', colL: 'L', colPF: 'PF', colPA: 'PA',
  tbH2h: 'Head-to-head', tbManual: 'Draw', tbNeedsDecision: 'Draw needed',
  saveOrder: 'Save order', clearManual: 'Clear manual order', noBracket: 'No bracket yet',
  slotGroupRank: '{rank} {group}', slotWinner: 'Winner {label}',
  vs: 'vs', tv: 'TV', diffCol: '+/-', pinLabel: 'PIN: {pin}', retry: 'Retry',
  ev_start: 'start', ev_rally: 'rally', ev_undo: 'undo', ev_special: 'special result', ev_override: 'override', ev_confirm: 'confirm', ev_reopen: 'reopen',
  pinOptional: 'PIN (optional)', hours: 'Hours', label: 'Label', createKey: 'Create key', revoke: 'Revoke',
  tokRevoked: 'Revoked', tokExpired: 'Expired', tokClaimed: 'Claimed', tokNotClaimed: 'Not claimed',
  shownOnce: 'The key is shown only once', refQrSubtitle: 'Scan to score', print: 'Print', printCourtQrs: 'Print court QRs',
  rank_1: '1st', rank_2: '2nd', rank_3: '3rd', rank_4: '4th', rankN: '#{n}',
  notFound: 'Page not found', shortLink: 'Short link', slugInvalid: 'Lowercase letters, digits and dashes only (2–40 chars)', copy: 'Copy', copied: 'Copied',
  urlHints: 'TV: {tv} · Court: {court}', courtUrlExample: 'court-1',
  printIdNote: 'Printed QRs use permanent IDs, so they keep working after court or link renames.',
  date: 'Date', wordmark: 'Pickleball', tournaments: 'Tournaments', tournamentsSub: 'Pick a tournament to follow live scores and schedules', noTournaments: 'No tournaments yet',
  eyebrowCourt: 'Court', eyebrowRef: 'Referee', scoreCallHint: 'serving – receiving – server', rallyWonShort: 'wins rally',
  round_final: 'Final', round_sf: 'Semi-final', round_qf: 'Quarter-final', round_n: 'Round of {n}',
  idleFor: 'Idle {min}m', server: 'Server', upNext: 'Up next', groupN: 'Group {name}', myMatchesCount: '{n} matches',
  setupTournamentDesc: 'Tournament name and date.', setupCourtsDesc: 'Add, rename and reorder courts.',
  setupTeamsDesc: 'Add teams one by one or paste a list from Excel.', setupStagesDesc: 'Group stage and knockout series, with game rules.',
  setupGroupsDesc: 'Split teams into groups, then generate group matches.', setupAdvDesc: 'Generate brackets and close the group stage.',
  sectionCount: '{n} match(es)', sec_now: 'Now playing', sec_upcoming: 'Upcoming', sec_done: 'Finished', sec_noCourt: 'No court yet',
  by_order: 'Order', by_court: 'By court', by_team: 'By team', by_group: 'By group',
  f_court: 'Court', f_team: 'Team', f_group: 'Group / stage', all: 'All', clearFilters: 'Clear filters',
  groupsMatches: 'Groups & matches', activeKeys: '{n} active keys', navMenu: 'Menu',
}

export type Lang = 'vi' | 'en'
export type T = (key: Key, vars?: Record<string, string | number>) => string

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'vi', setLang: () => {} })

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem('plc_lang') === 'en' ? 'en' : 'vi'))
  const setLang = useCallback((l: Lang) => { localStorage.setItem('plc_lang', l); setLangState(l) }, [])
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>
}

export function useT(): T {
  const { lang } = useContext(Ctx)
  return (key, vars) => {
    const s: string = (lang === 'en' ? en : vi)[key]
    return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')) : s
  }
}

export function LangToggle({ dark = false }: { dark?: boolean }) {
  const { lang, setLang } = useContext(Ctx)
  const opt = (l: Lang, text: string) => (
    <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}
      className={`h-7 rounded-full px-2.5 text-xs font-bold ${lang === l ? 'bg-white text-brand-700 shadow-sm' : dark ? 'text-brand-100' : 'text-ink-500'}`}>{text}</button>
  )
  return <div className={`inline-flex rounded-full p-0.5 ${dark ? 'bg-brand-800' : 'bg-ink-100'}`}>{opt('vi', 'VI')}{opt('en', 'EN')}</div>
}
