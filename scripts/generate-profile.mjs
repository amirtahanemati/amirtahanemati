import fs from 'node:fs/promises'
import path from 'node:path'

const username = process.env.PROFILE_USERNAME || 'amirtahanemati'
const token = process.env.PROFILE_TOKEN || process.env.GITHUB_TOKEN_FALLBACK || process.env.GITHUB_TOKEN
const generatedDir = path.resolve('generated')
const readmePath = path.resolve('README.md')

await fs.mkdir(generatedDir, { recursive: true })
for (const file of await fs.readdir(generatedDir)) {
  if (/^(repo-\d+|github-pulse)\.svg$/.test(file)) await fs.unlink(path.join(generatedDir, file))
}

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')

const fmt = (n) => new Intl.NumberFormat('en-US').format(Number(n || 0))
const shortDate = (iso) => iso ? new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit' }).format(new Date(iso)) : '—'
const daysAgo = (date) => date ? Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000)) : 9999

const languageColors = {
  JavaScript:'#F1E05A', TypeScript:'#3178C6', Python:'#3572A5', 'C++':'#F34B7D',
  Dart:'#00B4AB', HTML:'#E34C26', CSS:'#563D7C', Shell:'#89E051', C:'#555555', Java:'#B07219'
}

function baseSvg(width, height, body) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#fff" stroke-opacity=".032"/></pattern>
    <linearGradient id="lime" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#DFFF66"/><stop offset="1" stop-color="#75E700"/></linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#BFFF35" stop-opacity="0"/><stop offset=".5" stop-color="#BFFF35" stop-opacity=".15"/><stop offset="1" stop-color="#BFFF35" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="24" fill="#050505"/>
  <rect width="${width}" height="${height}" rx="24" fill="url(#grid)"/>
  <rect x="1" y="1" width="${width-2}" height="${height-2}" rx="23" fill="none" stroke="#fff" stroke-opacity=".09"/>
  ${body}
</svg>`
}

async function fetchRepos() {
  const repos = []
  for (let page = 1; ; page += 1) {
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': `${username}-profile`
    }
    if (token) headers.Authorization = `Bearer ${token}`
    const r = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?type=owner&sort=pushed&direction=desc&per_page=100&page=${page}`, { headers })
    if (!r.ok) throw new Error(`GitHub REST ${r.status}: ${await r.text()}`)
    const batch = await r.json()
    repos.push(...batch.map(repo => ({
      name: repo.name,
      description: repo.description || 'Software project on GitHub.',
      url: repo.html_url,
      stars: repo.stargazers_count || 0,
      forks: repo.forks_count || 0,
      fork: Boolean(repo.fork),
      archived: Boolean(repo.archived),
      pushedAt: repo.pushed_at,
      createdAt: repo.created_at,
      language: repo.language || 'Multi-stack'
    })))
    if (batch.length < 100) break
  }
  return repos.filter(r => !r.fork && !r.archived && r.name !== username)
}

async function fetchContributionStats() {
  if (!token) return { totalContributions: null, commits: null }
  const to = new Date()
  const from = new Date(to)
  from.setUTCFullYear(from.getUTCFullYear() - 1)
  const query = `query($login:String!,$from:DateTime!,$to:DateTime!){user(login:$login){contributionsCollection(from:$from,to:$to){totalCommitContributions contributionCalendar{totalContributions}}}}`
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization:`Bearer ${token}`, 'Content-Type':'application/json', 'User-Agent':`${username}-profile` },
    body: JSON.stringify({ query, variables:{ login:username, from:from.toISOString(), to:to.toISOString() } })
  })
  if (!r.ok) return { totalContributions: null, commits: null }
  const j = await r.json()
  const c = j.data?.user?.contributionsCollection
  return { totalContributions: c?.contributionCalendar?.totalContributions ?? null, commits: c?.totalCommitContributions ?? null }
}

function generatePulse(repos, contribution) {
  const totalStars = repos.reduce((s,r) => s + r.stars, 0)
  const stats = [
    ['PUBLIC REPOS', repos.length],
    ['TOTAL STARS', totalStars],
    ['12M CONTRIBUTIONS', contribution.totalContributions],
    ['12M COMMITS', contribution.commits]
  ]
  const cells = stats.map(([label,value],i) => {
    const x = 38 + i*282
    return `<g transform="translate(${x} 76)">
      <rect width="244" height="122" rx="18" fill="#090909" stroke="${i===0?'#BFFF35':'#fff'}" stroke-opacity="${i===0?'.3':'.08'}"/>
      <text x="18" y="30" fill="#777772" font-family="monospace" font-size="10" letter-spacing="1.3">${label}</text>
      <text x="18" y="82" fill="#F6F6F1" font-family="Arial,sans-serif" font-size="36" font-weight="900">${value == null ? '—' : fmt(value)}</text>
      <path d="M18 100H226" stroke="#fff" stroke-opacity=".06"/>
      <circle cx="218" cy="22" r="4" fill="#BFFF35"><animate attributeName="opacity" values=".2;1;.2" dur="${1.5+i*.25}s" repeatCount="indefinite"/></circle>
    </g>`
  }).join('')
  return baseSvg(1200, 240, `
    <text x="38" y="42" fill="#BFFF35" font-family="monospace" font-size="12" letter-spacing="2.4">03 / LIVE GITHUB PULSE</text>
    <text x="1162" y="42" text-anchor="end" fill="#767670" font-family="monospace" font-size="10">SYNCED BY GITHUB ACTIONS</text>
    ${cells}
    <rect x="-260" y="0" width="220" height="240" fill="url(#shine)"><animate attributeName="x" values="-260;1240" dur="6.5s" repeatCount="indefinite"/></rect>
  `)
}

function score(repo) {
  return repo.stars*24 + repo.forks*12 + Math.max(0, 220-daysAgo(repo.pushedAt))*1.2
}

function generateRepoCard(repo,index) {
  const color = languageColors[repo.language] || '#BFFF35'
  const desc = repo.description.slice(0,95)
  return baseSvg(570, 204, `
    <text x="28" y="36" fill="#6D6D67" font-family="monospace" font-size="10" letter-spacing="1.4">0${index+1} / SELECTED REPOSITORY</text>
    <text x="28" y="79" fill="#F5F5F0" font-family="Arial,sans-serif" font-size="23" font-weight="900">${esc(repo.name.slice(0,35))}</text>
    <text x="28" y="110" fill="#A0A09A" font-family="Arial,sans-serif" font-size="12">${esc(desc)}</text>
    <circle cx="32" cy="145" r="5" fill="${color}"/><text x="46" y="149" fill="#C8C8C2" font-family="monospace" font-size="11">${esc(repo.language)}</text>
    <text x="540" y="149" text-anchor="end" fill="#85857F" font-family="monospace" font-size="11">★ ${fmt(repo.stars)} • PUSH ${shortDate(repo.pushedAt).toUpperCase()}</text>
    <path d="M28 170H542" stroke="#fff" stroke-opacity=".07"/>
    <text x="28" y="188" fill="#BFFF35" font-family="monospace" font-size="10" letter-spacing="1.2">OPEN REPOSITORY ↗</text>
    <rect x="-180" y="0" width="150" height="204" fill="url(#shine)"><animate attributeName="x" values="-180;610" dur="${5.1+index*.5}s" repeatCount="indefinite"/></rect>
  `)
}

async function updateRepos(repos) {
  const chosen = [...repos].sort((a,b)=>score(b)-score(a)).slice(0,4)
  let md
  if (!chosen.length) {
    md = '<p align="center"><i>Run the profile workflow once to sync repositories.</i></p>'
  } else {
    const lines=['<p align="center">']
    for (let i=0;i<chosen.length;i++) {
      const file=`repo-${i+1}.svg`
      await fs.writeFile(path.join(generatedDir,file),generateRepoCard(chosen[i],i))
      lines.push(`  <a href="${chosen[i].url}"><img src="./generated/${file}" width="48.5%" alt="${esc(chosen[i].name)}" /></a>`)
    }
    lines.push('</p>')
    md=lines.join('\n')
  }
  const readme=await fs.readFile(readmePath,'utf8')
  const start='<!-- AUTO:REPOS:START -->'
  const end='<!-- AUTO:REPOS:END -->'
  const s=readme.indexOf(start), e=readme.indexOf(end)
  if(s<0||e<0) throw new Error('README repository markers missing')
  await fs.writeFile(readmePath,`${readme.slice(0,s+start.length)}\n${md}\n${readme.slice(e)}`)
}

const repos=await fetchRepos()
const contribution=await fetchContributionStats()
await fs.writeFile(path.join(generatedDir,'github-pulse.svg'),generatePulse(repos,contribution))
await updateRepos(repos)
console.log(`Generated V6 profile for ${username}: ${repos.length} public owned repositories`)
