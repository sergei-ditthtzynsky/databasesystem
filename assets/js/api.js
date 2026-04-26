const API = (() => {
  const base = () => `https://api.github.com/repos/${CFG.REPO}/contents`
  const hdrs = () => ({
    Authorization: `token ${CFG.GH_TOKEN}`,
    'Content-Type': 'application/json',
  })

  /* ── GET file ── */
  async function get(path) {
    const res = await fetch(`${base()}/${path}`, { headers: hdrs() })
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
    const raw  = await res.json()
    const data = JSON.parse(atob(raw.content.replace(/\n/g, '')))
    return { data, sha: raw.sha }
  }

  /* ── PUT file ── */
  async function put(path, sha, data, msg = 'vault update') {
    const body = JSON.stringify({
      message : msg,
      sha,
      content : btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
    })
    const res = await fetch(`${base()}/${path}`, { method:'PUT', headers: hdrs(), body })
    if (!res.ok) throw new Error(`PUT ${path} → ${res.status}`)
    return res.json()
  }

  /* ── Convenience ── */
  const tokens = () => get(CFG.DB.TOKENS)
  const roles  = () => get(CFG.DB.ROLES)
  const logs   = () => get(CFG.DB.LOGS)

  async function saveTokens(sha, list, msg) {
    return put(CFG.DB.TOKENS, sha, { tokens: list }, msg)
  }
  async function saveRoles(sha, users, msg) {
    return put(CFG.DB.ROLES, sha, { users }, msg)
  }
  async function appendLog(entry) {
    try {
      const f    = await logs()
      const list = f.data.logs || []
      list.unshift({ ...entry, time: tsNow() })
      if (list.length > 300) list.splice(300)
      await put(CFG.DB.LOGS, f.sha, { logs: list }, 'log: ' + entry.action)
    } catch (e) { console.warn('[log skip]', e) }
  }

  return { get, put, tokens, roles, logs, saveTokens, saveRoles, appendLog }
})()

/* ── Helpers global ── */
function tsNow() {
  return new Date().toLocaleString('id-ID', {
    day:'2-digit', month:'short', year:'numeric',
    hour:'2-digit', minute:'2-digit',
  })
}

function maskToken(t = '') {
  const p = t.split(':')
  if (p.length === 2)
    return `${p[0].slice(0,4)}***:${p[1].slice(0,4)}·····${p[1].slice(-3)}`
  return t.slice(0,5) + '·········' + t.slice(-3)
}

function rankOf(role = '') {
  return ROLES.indexOf(role.toLowerCase().trim())
}

function can(action) {
  if (typeof STATE === 'undefined' || !STATE.user) return false
  return rankOf(STATE.user.role) >= rankOf(PERMS[action] ?? 'developer')
}
