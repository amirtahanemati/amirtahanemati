import fs from 'node:fs/promises'
import path from 'node:path'

const username = process.env.PROFILE_USERNAME || 'amirtahanemati'
const token = process.env.PROFILE_TOKEN || process.env.GITHUB_TOKEN_FALLBACK || process.env.GITHUB_TOKEN
const mockMode = process.env.MOCK_PROFILE === '1'
const generatedDir = path.resolve('generated')
const readmePath = path.resolve('README.md')

await fs.mkdir(generatedDir, { recursive: true })
for (const file of await fs.readdir(generatedDir)) {
  await fs.unlink(path.join(generatedDir, file))
}

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')

const languageColors = {
  JavaScript: '#F1E05A',
  TypeScript: '#3178C6',
  Python: '#3572A5',
  'C++': '#F34B7D',
  Dart: '#00B4AB',
  HTML: '#E34C26',
  CSS: '#563D7C',
  Shell: '#89E051',
  C: '#555555',
  Java: '#B07219'
}

const fmt = (n) => new Intl.NumberFormat('en-US').format(Number(n || 0))
const shortDate = (iso) => iso ? new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit' }).format(new Date(iso)) : '—'
const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

function daysAgo(date) {
  if (!date) return 0
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
    <filter id="glow"><feGaussianBlur stdDeviation="6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
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
    repositories: { totalCount: 0, nodes: [] },
    contributionsCollection: {
      totalCommitContributions: 0,
      contributionCalendar: { totalContributions: 0, weeks },
      commitContributionsByRepository: []
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
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
        contributionCalendar {
          totalContributions
          weeks {
            firstDay
            contributionDays { date contributionCount weekday color }
          }
        }
        commitContributionsByRepository(maxRepositories: 25) {
          repository { name url }
          contributions(last: 14) {
            nodes { occurredAt commitCount isRestricted url repository { name url } }
          }
        }
      }
    }
  }`

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': `${username}-profile-dashboard`
    },
    body: JSON.stringify({ query, variables: { login: username, from, to } })
  })

  if (!response.ok) throw new Error(`GitHub GraphQL HTTP ${response.status}: ${await response.text()}`)
  const payload = await response.json()
  if (payload.errors?.length) throw new Error(`GitHub GraphQL: ${payload.errors.map((e) => e.message).join('; ')}`)
  if (!payload.data?.user) throw new Error(`GitHub user ${username} was not returned by GraphQL`)
  return payload.data.user
}

async function fetchAllPublicRepos() {
  if (mockMode) return []
  const repos = []
  for (let page = 1; ; page += 1) {
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': `${username}-profile-dashboard`
    }
    if (token) headers.Authorization = `Bearer ${token}`

    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?type=owner&sort=pushed&direction=desc&per_page=100&page=${page}`, { headers })
    if (!response.ok) throw new Error(`GitHub REST repositories HTTP ${response.status}: ${await response.text()}`)
    const batch = await response.json()
    repos.push(...batch.map((repo) => ({
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
      primaryLanguage: repo.language ? { name: repo.language, color: languageColors[repo.language] || '#C7FF3D' } : null
    })))
    if (batch.length < 100) break
  }
  return repos
}

function repositoryList(user) {
  return (user.repositories?.nodes || []).filter((r) => !r.isFork && !r.isArchived && r.name !== username)
}

function totalStars(repos) {
  return repos.reduce((sum, repo) => sum + (repo.stargazerCount || 0), 0)
}

function generateSignal(user, repos, days) {
  const totalContributions = user.contributionsCollection?.contributionCalendar?.totalContributions ?? 0
  const { current } = streaks(days)
  const stats = [
    ['PUBLIC REPOS', user.repositories?.totalCount ?? 0],
    ['TOTAL STARS', totalStars(repos)],
    ['12M CONTRIBUTIONS', totalContributions],
    ['CURRENT STREAK', `${current}d`]
  ]

  const cells = stats.map(([label, value], i) => {
    const x = 38 + i * 282
    return `<g transform="translate(${x} 72)">
      <rect width="244" height="112" rx="16" fill="#0A0A0A" stroke="${i === 0 ? '#C7FF3D' : '#FFFFFF'}" stroke-opacity="${i === 0 ? '.35' : '.09'}"/>
      <text x="16" y="30" fill="#82827C" font-family="monospace" font-size="10" letter-spacing="1.2">${esc(label)}</text>
      <text x="16" y="78" fill="#F4F4EF" font-family="Arial, sans-serif" font-size="34" font-weight="800">${user.placeholder ? '—' : esc(typeof value === 'number' ? fmt(value) : value)}</text>
      <circle cx="220" cy="24" r="4" fill="#C7FF3D" opacity=".8"><animate attributeName="opacity" values=".2;1;.2" dur="${1.6 + i * .2}s" repeatCount="indefinite"/></circle>
    </g>`
  }).join('')

  return baseSvg(1200, 222, `
    <text x="38" y="42" fill="#C7FF3D" font-family="monospace" font-size="12" letter-spacing="2">LIVE GITHUB SIGNAL / ${user.placeholder ? 'WAITING FOR FIRST SYNC' : 'SYNCED'}</text>
    <text x="1162" y="42" text-anchor="end" fill="#85857F" font-family="monospace" font-size="11">PUBLIC ACTIVITY • AUTOMATICALLY REFRESHED</text>
    ${cells}
    <rect x="-300" y="0" width="260" height="222" fill="url(#shine)"><animate attributeName="x" values="-300;1240" dur="6s" repeatCount="indefinite"/></rect>
  `)
}

function buildSnakePath(points) {
  if (points.length === 0) return ''
  let d = `M${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]
    const p = points[i]
    const cx = (prev.x + p.x) / 2
    d += ` Q ${cx} ${prev.y}, ${p.x} ${p.y}`
  }
  return d
}

function generateCommitSnake(user, days) {
  const active = days.filter((d) => d.contributionCount > 0).slice(-14)
  const list = active.length ? active : [{ date: null, contributionCount: 0 }]
  const step = list.length > 1 ? 1010 / (list.length - 1) : 0
  const points = list.map((d, i) => ({
    x: 96 + i * step,
    y: 136 + Math.sin(i * 0.78) * 34,
    count: d.contributionCount,
    date: d.date
  }))
  const d = buildSnakePath(points)

  const pellets = points.map((p, i) => {
    const r = user.placeholder ? 6 : clamp(4 + Math.sqrt(p.count || 1), 5, 13)
    return `<g>
      <circle cx="${p.x}" cy="${p.y}" r="${r}" fill="#0E0E0E" stroke="#C7FF3D" stroke-opacity=".35"/>
      <circle cx="${p.x}" cy="${p.y}" r="${Math.max(3, r - 2)}" fill="#C7FF3D" opacity=".82"><animate attributeName="opacity" values=".35;1;.35" dur="${1.3 + i * 0.12}s" repeatCount="indefinite"/></circle>
      <text x="${p.x}" y="${p.y + 28}" text-anchor="middle" fill="#777772" font-family="monospace" font-size="9">${p.date ? shortDate(p.date).toUpperCase() : 'SYNC'}</text>
    </g>`
  }).join('')

  const body = d ? `<path id="snakePath" d="${d}" fill="none" stroke="#6A9E12" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" opacity=".22"/>
    <path d="${d}" fill="none" stroke="url(#lime)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
    <path d="${d}" fill="none" stroke="#D8FF55" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="10 18"><animate attributeName="stroke-dashoffset" values="0;-112" dur="4s" repeatCount="indefinite"/></path>` : ''

  const snakeHead = d ? `<g>
      <animateMotion dur="5.6s" repeatCount="indefinite" rotate="auto">
        <mpath href="#snakePath"/>
      </animateMotion>
      <ellipse cx="0" cy="0" rx="16" ry="12" fill="#D8FF55"/>
      <circle cx="5" cy="-3" r="2" fill="#050505"/>
      <path d="M14 0L24 -3L24 3Z" fill="#FF7D7D"><animate attributeName="opacity" values="1;.2;1" dur="0.6s" repeatCount="indefinite"/></path>
    </g>` : ''

  const total = user.contributionsCollection?.totalCommitContributions ?? 0
  return baseSvg(1200, 258, `
    <text x="38" y="40" fill="#C7FF3D" font-family="monospace" font-size="12" letter-spacing="2">COMMIT SNAKE / RECENT ACTIVE COMMIT-DAYS</text>
    <text x="1162" y="40" text-anchor="end" fill="#85857F" font-family="monospace" font-size="11">${user.placeholder ? 'SYNC PENDING' : `${fmt(total)} COMMITS / 12M`}</text>
    <text x="38" y="72" fill="#8A8A84" font-family="Arial, sans-serif" font-size="13">A custom snake that moves through your recent commit activity and "eats" each active commit-day.</text>
    ${pellets}
    ${body}
    ${snakeHead}
    <rect x="-260" y="0" width="220" height="258" fill="url(#shine)"><animate attributeName="x" values="-260;1260" dur="6.8s" repeatCount="indefinite"/></rect>
  `)
}

function repoScore(repo) {
  const recent = Math.max(0, 180 - daysAgo(repo.pushedAt || repo.createdAt))
  return (repo.stargazerCount || 0) * 20 + (repo.forkCount || 0) * 10 + recent
}

function selectRepos(repos) {
  return [...repos].sort((a, b) => repoScore(b) - repoScore(a)).slice(0, 4)
}

function generateRepoCard(repo, index) {
  const lang = repo.primaryLanguage?.name || 'Multi-stack'
  const langColor = repo.primaryLanguage?.color || '#C7FF3D'
  const desc = (repo.description || 'Engineering repository on GitHub.').slice(0, 92)
  return baseSvg(570, 178, `
    <text x="28" y="35" fill="#6F6F69" font-family="monospace" font-size="10" letter-spacing="1.3">0${index + 1} / REPOSITORY</text>
    <text x="28" y="75" fill="#F4F4EF" font-family="Arial, sans-serif" font-size="22" font-weight="800">${esc(repo.name.slice(0, 34))}</text>
    <text x="28" y="104" fill="#A0A09A" font-family="Arial, sans-serif" font-size="12">${esc(desc)}</text>
    <circle cx="31" cy="137" r="5" fill="${langColor}"/><text x="44" y="141" fill="#C6C6C0" font-family="monospace" font-size="11">${esc(lang)}</text>
    <text x="540" y="141" text-anchor="end" fill="#85857F" font-family="monospace" font-size="11">★ ${fmt(repo.stargazerCount)}  •  PUSH ${shortDate(repo.pushedAt)}</text>
    <path d="M28 156H542" stroke="#fff" stroke-opacity=".06"/>
    <rect x="-180" y="0" width="150" height="178" fill="url(#shine)"><animate attributeName="x" values="-180;610" dur="${5 + index * .4}s" repeatCount="indefinite"/></rect>
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
  const days = weeks.flatMap((w) => w.contributionDays || [])

  await fs.writeFile(path.join(generatedDir, 'github-signal.svg'), generateSignal(user, repos, days))
  await fs.writeFile(path.join(generatedDir, 'commit-snake.svg'), generateCommitSnake(user, days))
  const repoMarkdown = await generateRepoSection(repos, user)
  await updateReadme(repoMarkdown)
  console.log(`Profile generated for ${username}: ${repos.length} public owned repositories`)
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
