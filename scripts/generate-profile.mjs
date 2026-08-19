import fs from 'node:fs/promises'
import path from 'node:path'

const username = process.env.PROFILE_USERNAME || 'amirtahanemati'
const token = process.env.PROFILE_TOKEN || process.env.GITHUB_TOKEN_FALLBACK || process.env.GITHUB_TOKEN
const mockMode = process.env.MOCK_PROFILE === '1'
const generatedDir = path.resolve('generated')
const readmePath = path.resolve('README.md')
const showcasePath = path.resolve('data/showcase.json')

await fs.mkdir(generatedDir, { recursive: true })
for (const file of await fs.readdir(generatedDir)) {
  if (/^repo-\d+\.svg$/.test(file)) await fs.unlink(path.join(generatedDir, file))
}

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')

const clamp = (n, min, max) => Math.max(min, Math.min(max, n))
const languageColors = { JavaScript:'#F1E05A', TypeScript:'#3178C6', Python:'#3572A5', 'C++':'#F34B7D', Dart:'#00B4AB', HTML:'#E34C26', CSS:'#563D7C', Shell:'#89E051', C:'#555555', Java:'#B07219' }
const fmt = (n) => new Intl.NumberFormat('en-US').format(Number(n || 0))
const shortDate = (iso) => iso ? new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit' }).format(new Date(iso)) : '—'

function daysAgo(date) {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000))
}

function streaks(days) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  let longest = 0
  let running = 0
  for (const d of sorted) {
    if (d.contributionCount > 0) {
      running += 1
      longest = Math.max(longest, running)
    } else {
      running = 0
    }
  }

  let current = 0
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i].contributionCount > 0) current += 1
    else if (i === sorted.length - 1) continue
    else break
  }
  return { current, longest }
}

function baseSvg(width, height, body, extraDefs = '') {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#fff" stroke-opacity=".032"/></pattern>
    <linearGradient id="lime" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#D8FF55"/><stop offset="1" stop-color="#8FFF00"/></linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#C7FF3D" stop-opacity="0"/><stop offset=".5" stop-color="#C7FF3D" stop-opacity=".16"/><stop offset="1" stop-color="#C7FF3D" stop-opacity="0"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    ${extraDefs}
  </defs>
  <rect width="${width}" height="${height}" rx="24" fill="#050505"/>
  <rect width="${width}" height="${height}" rx="24" fill="url(#grid)"/>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="23" fill="none" stroke="#fff" stroke-opacity=".095"/>
  ${body}
</svg>`
}

function placeholderData() {
  const today = new Date()
  const weeks = []
  const start = new Date(today)
  start.setDate(start.getDate() - 364)
  start.setDate(start.getDate() - start.getDay())
  for (let w = 0; w < 53; w += 1) {
    const contributionDays = []
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(start)
      date.setDate(start.getDate() + w * 7 + d)
      contributionDays.push({ date: date.toISOString().slice(0, 10), contributionCount: 0, weekday: d, color: '#151515' })
    }
    weeks.push({ firstDay: contributionDays[0].date, contributionDays })
  }
  return {
    login: username,
    name: 'Amirtaha Nemati',
    followers: { totalCount: 0 },
    repositories: { totalCount: 0, nodes: [] },
    contributionsCollection: {
      totalCommitContributions: 0,
      totalIssueContributions: 0,
      totalPullRequestContributions: 0,
      totalPullRequestReviewContributions: 0,
      totalRepositoryContributions: 0,
      restrictedContributionsCount: 0,
      commitContributionsByRepository: [],
      contributionCalendar: { totalContributions: 0, weeks }
    },
    placeholder: true
  }
}

async function fetchProfile() {
  if (mockMode || !token) return placeholderData()

  const now = new Date()
  const to = now.toISOString()
  const fromDate = new Date(now)
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 1)
  const from = fromDate.toISOString()

  const query = `query ProfileDashboard($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      login
      name
      avatarUrl
      url
      followers { totalCount }
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        totalRepositoryContributions
        restrictedContributionsCount
        commitContributionsByRepository(maxRepositories: 25) {
          repository { name url }
          contributions(last: 12) {
            nodes { occurredAt commitCount isRestricted url repository { name url } }
          }
        }
        contributionCalendar {
          totalContributions
          weeks {
            firstDay
            contributionDays { date contributionCount weekday color }
          }
        }
      }
    }
  }`

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': `${username}-profile-dashboard`
    },
    body: JSON.stringify({ query, variables: { login: username, from, to } })
  })

  if (!response.ok) throw new Error(`GitHub GraphQL HTTP ${response.status}: ${await response.text()}`)
  const payload = await response.json()
  if (payload.errors?.length) throw new Error(`GitHub GraphQL: ${payload.errors.map(e => e.message).join('; ')}`)
  if (!payload.data?.user) throw new Error(`GitHub user ${username} was not returned by GraphQL`)
  return payload.data.user
}


async function fetchAllPublicRepos() {
  if (mockMode) return []
  const repos = []
  for (let page = 1; ; page += 1) {
    const headers = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
      'User-Agent': `${username}-profile-dashboard`
    }
    if (token) headers.Authorization = `Bearer ${token}`
    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?type=owner&sort=pushed&direction=desc&per_page=100&page=${page}`, { headers })
    if (!response.ok) throw new Error(`GitHub REST repositories HTTP ${response.status}: ${await response.text()}`)
    const batch = await response.json()
    repos.push(...batch.map(repo => ({
      name: repo.name,
      description: repo.description,
      url: repo.html_url,
      stargazerCount: repo.stargazers_count || 0,
      forkCount: repo.forks_count || 0,
      isFork: Boolean(repo.fork),
      isArchived: Boolean(repo.archived),
      pushedAt: repo.pushed_at,
      createdAt: repo.created_at,
      size: repo.size || 0,
      primaryLanguage: repo.language ? { name: repo.language, color: languageColors[repo.language] || '#C7FF3D' } : null,
    })))
    if (batch.length < 100) break
  }
  return repos
}

function repositoryList(user) {
  return (user.repositories?.nodes || [])
    .filter(r => !r.isFork && !r.isArchived && r.name !== username)
}

function totalStars(repos) {
  return repos.reduce((sum, repo) => sum + (repo.stargazerCount || 0), 0)
}

function generateSignal(user, repos, days) {
  const cal = user.contributionsCollection?.contributionCalendar || { totalContributions: 0 }
  const { current, longest } = streaks(days)
  const stats = [
    ['PUBLIC REPOS', user.repositories?.totalCount ?? 0],
    ['FOLLOWERS', user.followers?.totalCount ?? 0],
    ['TOTAL STARS', totalStars(repos)],
    ['12M CONTRIBUTIONS', cal.totalContributions ?? 0],
    ['CURRENT STREAK', `${current}d`],
    ['LONGEST STREAK', `${longest}d`],
  ]
  const cells = stats.map(([label, value], i) => {
    const x = 38 + i * 187
    return `<g transform="translate(${x} 74)">
      <rect width="169" height="112" rx="16" fill="#0A0A0A" stroke="${i === 0 ? '#C7FF3D' : '#FFFFFF'}" stroke-opacity="${i === 0 ? '.35' : '.09'}"/>
      <text x="16" y="30" fill="#82827C" font-family="monospace" font-size="10" letter-spacing="1.2">${esc(label)}</text>
      <text x="16" y="78" fill="#F4F4EF" font-family="Arial, sans-serif" font-size="31" font-weight="800">${user.placeholder ? '—' : esc(typeof value === 'number' ? fmt(value) : value)}</text>
      <circle cx="145" cy="25" r="4" fill="#C7FF3D" opacity="${i < 4 ? '.8' : '.45'}"><animate attributeName="opacity" values=".2;1;.2" dur="${1.6 + i * .2}s" repeatCount="indefinite"/></circle>
    </g>`
  }).join('')
  return baseSvg(1200, 226, `
    <text x="38" y="42" fill="#C7FF3D" font-family="monospace" font-size="12" letter-spacing="2">LIVE GITHUB SIGNAL / ${user.placeholder ? 'WAITING FOR FIRST SYNC' : 'SYNCED'}</text>
    ${cells}
    <rect x="-300" y="0" width="260" height="226" fill="url(#shine)"><animate attributeName="x" values="-300;1240" dur="6s" repeatCount="indefinite"/></rect>
  `)
}

function generateContributionGrid(user, weeks) {
  const cell = 13
  const gap = 4
  const left = 78
  const top = 70
  const levelColor = (count) => {
    if (!count) return '#121212'
    if (count <= 1) return '#26320F'
    if (count <= 3) return '#496C12'
    if (count <= 6) return '#76B51B'
    return '#C7FF3D'
  }
  let rects = ''
  weeks.slice(-53).forEach((week, wi) => {
    week.contributionDays.forEach((day, di) => {
      const x = left + wi * (cell + gap)
      const y = top + di * (cell + gap)
      const fill = levelColor(day.contributionCount)
      rects += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" fill="${fill}" stroke="#fff" stroke-opacity=".025"><title>${esc(day.date)}: ${day.contributionCount} contributions</title></rect>`
    })
  })
  const total = user.contributionsCollection?.contributionCalendar?.totalContributions ?? 0
  const commits = user.contributionsCollection?.totalCommitContributions ?? 0
  const prs = user.contributionsCollection?.totalPullRequestContributions ?? 0
  const issues = user.contributionsCollection?.totalIssueContributions ?? 0
  return baseSvg(1200, 250, `
    <text x="38" y="40" fill="#C7FF3D" font-family="monospace" font-size="12" letter-spacing="2">CONTRIBUTION TIMELINE / ROLLING 12 MONTHS</text>
    <text x="1162" y="40" text-anchor="end" fill="#8A8A84" font-family="monospace" font-size="11">${user.placeholder ? 'SYNC PENDING' : `${fmt(total)} TOTAL • ${fmt(commits)} COMMITS • ${fmt(prs)} PR • ${fmt(issues)} ISSUES`}</text>
    ${rects}
    <rect x="${left - 28}" y="58" width="28" height="135" fill="url(#shine)" opacity=".9"><animate attributeName="x" values="${left - 28};${left + 53*(cell+gap)}" dur="5.2s" repeatCount="indefinite"/></rect>
    <text x="78" y="222" fill="#62625E" font-family="monospace" font-size="10">LESS</text>
    <rect x="112" y="211" width="10" height="10" rx="2" fill="#121212"/><rect x="128" y="211" width="10" height="10" rx="2" fill="#26320F"/><rect x="144" y="211" width="10" height="10" rx="2" fill="#496C12"/><rect x="160" y="211" width="10" height="10" rx="2" fill="#76B51B"/><rect x="176" y="211" width="10" height="10" rx="2" fill="#C7FF3D"/>
    <text x="194" y="222" fill="#62625E" font-family="monospace" font-size="10">MORE</text>
  `)
}

function languageTotals(repos) {
  const totals = new Map()
  for (const repo of repos) {
    const edges = repo.languages?.edges || []
    if (edges.length) {
      for (const edge of edges) {
        const name = edge.node?.name
        if (!name) continue
        const current = totals.get(name) || { size: 0, color: edge.node.color || '#C7FF3D' }
        current.size += edge.size || 0
        totals.set(name, current)
      }
      continue
    }
    const name = repo.primaryLanguage?.name
    if (!name) continue
    const current = totals.get(name) || { size: 0, color: repo.primaryLanguage?.color || '#C7FF3D' }
    current.size += Math.max(1, repo.size || 1)
    totals.set(name, current)
  }
  return [...totals.entries()].map(([name, v]) => ({ name, ...v })).sort((a,b) => b.size - a.size).slice(0, 8)
}

function generateLanguages(user, repos) {
  const langs = languageTotals(repos)
  const sum = langs.reduce((s, l) => s + l.size, 0) || 1
  const rows = (langs.length ? langs : [{name:'Waiting for GitHub sync', size:1, color:'#C7FF3D'}]).map((l, i) => {
    const pct = user.placeholder ? 0 : (l.size / sum) * 100
    const y = 74 + i * 31
    const width = user.placeholder ? 20 : clamp(700 * pct / Math.max(20, (langs[0]?.size / sum) * 100), 16, 700)
    return `<text x="46" y="${y+12}" fill="#D9D9D4" font-family="monospace" font-size="12">${esc(l.name)}</text>
      <rect x="216" y="${y}" width="760" height="14" rx="7" fill="#111"/>
      <rect x="216" y="${y}" width="${width}" height="14" rx="7" fill="${l.color || '#C7FF3D'}" opacity=".78"><animate attributeName="opacity" values=".55;.95;.55" dur="${3+i*.25}s" repeatCount="indefinite"/></rect>
      <text x="1148" y="${y+12}" text-anchor="end" fill="#85857F" font-family="monospace" font-size="11">${user.placeholder ? '—' : pct.toFixed(1)+'%'}</text>`
  }).join('')
  const height = 100 + Math.max(1, langs.length) * 31 + 26
  return baseSvg(1200, height, `<text x="38" y="39" fill="#C7FF3D" font-family="monospace" font-size="12" letter-spacing="2">LANGUAGE FOOTPRINT / PUBLIC REPOSITORIES</text>${rows}`)
}

function repoScore(repo) {
  const recent = Math.max(0, 180 - daysAgo(repo.pushedAt || repo.createdAt))
  return (repo.stargazerCount || 0) * 20 + (repo.forkCount || 0) * 10 + recent
}

function selectRepos(repos) {
  return [...repos].sort((a,b) => repoScore(b) - repoScore(a)).slice(0, 6)
}

function generateRepoCard(repo, index) {
  const lang = repo.primaryLanguage?.name || 'Multi-stack'
  const langColor = repo.primaryLanguage?.color || '#C7FF3D'
  const desc = (repo.description || 'Engineering repository on GitHub.').slice(0, 96)
  return baseSvg(570, 178, `
    <text x="28" y="35" fill="#6F6F69" font-family="monospace" font-size="10" letter-spacing="1.3">0${index + 1} / REPOSITORY</text>
    <text x="28" y="75" fill="#F4F4EF" font-family="Arial, sans-serif" font-size="22" font-weight="800">${esc(repo.name.slice(0, 34))}</text>
    <text x="28" y="104" fill="#A0A09A" font-family="Arial, sans-serif" font-size="12">${esc(desc)}</text>
    <circle cx="31" cy="137" r="5" fill="${langColor}"/><text x="44" y="141" fill="#C6C6C0" font-family="monospace" font-size="11">${esc(lang)}</text>
    <text x="540" y="141" text-anchor="end" fill="#85857F" font-family="monospace" font-size="11">★ ${fmt(repo.stargazerCount)}  •  PUSH ${shortDate(repo.pushedAt)}</text>
    <path d="M28 156H542" stroke="#fff" stroke-opacity=".06"/>
    <rect x="-180" y="0" width="150" height="178" fill="url(#shine)"><animate attributeName="x" values="-180;610" dur="${5 + index*.4}s" repeatCount="indefinite"/></rect>
  `)
}

async function generateRepoSection(repos, user) {
  if (user.placeholder || repos.length === 0) {
    return '<p align="center"><i>Repository cards will sync on the first GitHub Actions run.</i></p>'
  }
  const chosen = selectRepos(repos)
  const lines = ['<p align="center">']
  for (let i = 0; i < chosen.length; i += 1) {
    const repo = chosen[i]
    const file = `repo-${i + 1}.svg`
    await fs.writeFile(path.join(generatedDir, file), generateRepoCard(repo, i))
    lines.push(`  <a href="${repo.url}"><img src="./generated/${file}" width="48.5%" alt="${esc(repo.name)}" /></a>`)
  }
  lines.push('</p>')
  return lines.join('\n')
}


function commitEntries(user) {
  const groups = user.contributionsCollection?.commitContributionsByRepository || []
  return groups.flatMap(group => (group.contributions?.nodes || []).map(node => ({
    repo: node.repository?.name || group.repository?.name || 'repository',
    repoUrl: node.repository?.url || group.repository?.url || '#',
    occurredAt: node.occurredAt,
    commitCount: node.commitCount || 0,
    restricted: Boolean(node.isRestricted),
    url: node.url || group.repository?.url || '#'
  }))).sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
}

function generateCommitFlow(user) {
  const entries = commitEntries(user).slice(0, 9)
  const list = entries.length ? entries : [{repo:'Waiting for live GitHub sync', occurredAt:null, commitCount:0, restricted:false}]
  const width = 1200
  const nodeGap = list.length > 1 ? 1030 / (list.length - 1) : 0
  let nodes = ''
  list.forEach((item, i) => {
    const x = 84 + i * nodeGap
    const y = 126 + (i % 2 ? 26 : -12)
    const count = user.placeholder ? '—' : item.commitCount
    nodes += `<g>
      ${i < list.length - 1 ? `<path d="M${x+12} ${y} C${x+45} ${y}, ${84+(i+1)*nodeGap-45} ${126+((i+1)%2?26:-12)}, ${84+(i+1)*nodeGap-12} ${126+((i+1)%2?26:-12)}" fill="none" stroke="#C7FF3D" stroke-opacity=".18" stroke-width="2" stroke-dasharray="5 8"><animate attributeName="stroke-dashoffset" values="0;-26" dur="2.2s" repeatCount="indefinite"/></path>` : ''}
      <circle cx="${x}" cy="${y}" r="17" fill="#0A0A0A" stroke="#C7FF3D" stroke-opacity="${i===0?'.75':'.28'}" stroke-width="2"/>
      <circle cx="${x}" cy="${y}" r="5" fill="#C7FF3D"><animate attributeName="opacity" values=".25;1;.25" dur="${1.4+i*.13}s" repeatCount="indefinite"/></circle>
      <text x="${x}" y="${y+40}" text-anchor="middle" fill="#F1F1EC" font-family="Arial, sans-serif" font-size="11" font-weight="700">${esc(item.repo.slice(0,18))}</text>
      <text x="${x}" y="${y+57}" text-anchor="middle" fill="#777772" font-family="monospace" font-size="9">${item.occurredAt ? shortDate(item.occurredAt).toUpperCase() : 'SYNC'} • ${count} COMMIT${count===1?'':'S'}</text>
    </g>`
  })
  const total = user.contributionsCollection?.totalCommitContributions ?? 0
  return baseSvg(width, 238, `
    <text x="38" y="40" fill="#C7FF3D" font-family="monospace" font-size="12" letter-spacing="2">COMMIT FLOW / RECENT COMMIT-DAYS</text>
    <text x="1162" y="40" text-anchor="end" fill="#85857F" font-family="monospace" font-size="11">${user.placeholder ? 'SYNC PENDING' : `${fmt(total)} COMMITS / 12M`}</text>
    ${nodes}
    <rect x="-260" y="0" width="220" height="238" fill="url(#shine)"><animate attributeName="x" values="-260;1260" dur="6.6s" repeatCount="indefinite"/></rect>
  `)
}

function generateActivity(user, repos) {
  const recent = [...repos].sort((a,b) => new Date(b.pushedAt) - new Date(a.pushedAt)).slice(0, 6)
  const list = recent.length ? recent : [{name:'Waiting for live sync', pushedAt:null, primaryLanguage:{name:'GitHub API'}, stargazerCount:0}]
  const rows = list.map((r, i) => {
    const y = 72 + i * 52
    return `<circle cx="53" cy="${y}" r="6" fill="${i === 0 ? '#C7FF3D' : '#393936'}"><animate attributeName="opacity" values=".4;1;.4" dur="${1.5+i*.22}s" repeatCount="indefinite"/></circle>
      ${i < list.length-1 ? `<path d="M53 ${y+8}V${y+46}" stroke="#fff" stroke-opacity=".09"/>` : ''}
      <text x="80" y="${y-5}" fill="#F2F2ED" font-family="Arial, sans-serif" font-size="15" font-weight="700">${esc(r.name)}</text>
      <text x="80" y="${y+16}" fill="#85857F" font-family="monospace" font-size="10">${esc(r.primaryLanguage?.name || 'Multi-stack')}  •  ${r.pushedAt ? `${daysAgo(r.pushedAt)} DAYS AGO` : 'SYNC PENDING'}  •  ★ ${fmt(r.stargazerCount)}</text>`
  }).join('')
  const h = 106 + list.length * 52
  return baseSvg(1200, h, `<text x="38" y="38" fill="#C7FF3D" font-family="monospace" font-size="12" letter-spacing="2">RECENT REPOSITORY PULSE</text>${rows}<rect x="-280" y="0" width="220" height="${h}" fill="url(#shine)"><animate attributeName="x" values="-280;1260" dur="7s" repeatCount="indefinite"/></rect>`)
}

async function generateLab() {
  let data = { projects: [] }
  try { data = JSON.parse(await fs.readFile(showcasePath, 'utf8')) } catch {}
  const projects = (data.projects || []).slice(0, 4)
  const list = projects.length ? projects : [{name:'Private build slot',status:'LAB',description:'Add public-safe project details to data/showcase.json',stack:['Electron.js']}]
  const cards = list.map((p, i) => {
    const y = 66 + i * 88
    return `<g transform="translate(40 ${y})"><rect width="1120" height="70" rx="14" fill="#0A0A0A" stroke="#fff" stroke-opacity=".08"/><text x="18" y="25" fill="#C7FF3D" font-family="monospace" font-size="10" letter-spacing="1">${esc(p.status || 'LAB')}</text><text x="18" y="49" fill="#F4F4EF" font-family="Arial, sans-serif" font-size="17" font-weight="750">${esc(p.name)}</text><text x="380" y="29" fill="#A0A09A" font-family="Arial, sans-serif" font-size="11">${esc((p.description || '').slice(0, 92))}</text><text x="380" y="50" fill="#70706B" font-family="monospace" font-size="10">${esc((p.stack || []).join('  •  '))}</text></g>`
  }).join('')
  return baseSvg(1200, 96 + list.length*88, `<text x="38" y="38" fill="#C7FF3D" font-family="monospace" font-size="12" letter-spacing="2">PRIVATE / UNPUBLISHED SHOWCASE — MANUAL SAFE METADATA</text>${cards}`)
}

async function updateReadme(repoMarkdown) {
  const readme = await fs.readFile(readmePath, 'utf8')
  const start = '<!-- AUTO:REPOS:START -->'
  const end = '<!-- AUTO:REPOS:END -->'
  const s = readme.indexOf(start)
  const e = readme.indexOf(end)
  if (s === -1 || e === -1 || e < s) throw new Error('README auto repository markers are missing')
  const next = `${readme.slice(0, s + start.length)}\n${repoMarkdown}\n${readme.slice(e)}`
  await fs.writeFile(readmePath, next)
}

try {
  const user = await fetchProfile()
  const allRepos = await fetchAllPublicRepos()
  user.repositories = { totalCount: allRepos.length, nodes: allRepos }
  const repos = repositoryList(user)
  const weeks = user.contributionsCollection?.contributionCalendar?.weeks || []
  const days = weeks.flatMap(w => w.contributionDays || [])

  await fs.writeFile(path.join(generatedDir, 'github-signal.svg'), generateSignal(user, repos, days))
  await fs.writeFile(path.join(generatedDir, 'contribution-grid.svg'), generateContributionGrid(user, weeks))
  await fs.writeFile(path.join(generatedDir, 'language-radar.svg'), generateLanguages(user, repos))
  await fs.writeFile(path.join(generatedDir, 'commit-flow.svg'), generateCommitFlow(user))
  await fs.writeFile(path.join(generatedDir, 'activity-stream.svg'), generateActivity(user, repos))
  await fs.writeFile(path.join(generatedDir, 'lab-showcase.svg'), await generateLab())
  const repoMarkdown = await generateRepoSection(repos, user)
  await updateReadme(repoMarkdown)
  console.log(`Profile generated for ${username}: ${repos.length} public owned repositories`)
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
