// GitHub 开源仓库搜索：只代理公开搜索、README 和 open issues。
// 用户可选填只读 Token，用来把 GitHub 的低速匿名额度提到 5000 次/小时。
const API_URL = 'https://api.github.com';
const TIMEOUT_MS = 20000;

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function headersFor(token, accept) {
  const headers = {
    accept: accept || 'application/vnd.github+json',
    'user-agent': 'momo-phone-github-search',
    'x-github-api-version': '2022-11-28'
  };
  if (token) headers.authorization = 'Bearer ' + token;
  return headers;
}

async function githubFetch(path, token, accept) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(API_URL + path, { headers: headersFor(token, accept), signal: controller.signal });
    const text = await resp.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    return { resp, text, data };
  } finally {
    clearTimeout(timer);
  }
}

function rateInfo(resp) {
  return {
    remaining: resp.headers.get('x-ratelimit-remaining'),
    reset: resp.headers.get('x-ratelimit-reset'),
    limit: resp.headers.get('x-ratelimit-limit')
  };
}

function providerError(resp, data) {
  const message = String((data && data.message) || '').trim();
  if (resp.status === 401) return json(401, { error: 'invalid_github_token', detail: message.slice(0, 200) });
  if (resp.status === 403 || resp.status === 429) {
    const info = rateInfo(resp);
    if (String(info.remaining || '') === '0' || /rate limit/i.test(message)) {
      return json(429, {
        error: 'github_rate_limited',
        detail: message.slice(0, 200),
        reset_at: info.reset ? Number(info.reset) * 1000 : null,
        remaining: info.remaining
      });
    }
    return json(403, { error: 'github_forbidden', detail: message.slice(0, 200) });
  }
  if (resp.status === 404) return json(404, { error: 'not_found', detail: message.slice(0, 200) });
  return json(502, {
    error: 'github_error',
    status: resp.status,
    detail: message.slice(0, 200) || ('http_' + resp.status)
  });
}

function normalizeRepo(row) {
  if (!row || typeof row !== 'object' || !row.full_name) return null;
  return {
    full_name: String(row.full_name),
    name: String(row.name || ''),
    owner: String((row.owner && row.owner.login) || ''),
    url: String(row.html_url || ('https://github.com/' + row.full_name)),
    description: String(row.description || '').trim(),
    homepage: String(row.homepage || '').trim(),
    language: String(row.language || '').trim(),
    license: String((row.license && (row.license.spdx_id || row.license.name)) || '').trim(),
    stars: Number(row.stargazers_count || 0),
    forks: Number(row.forks_count || 0),
    open_issues: Number(row.open_issues_count || 0),
    topics: Array.isArray(row.topics) ? row.topics.slice(0, 10).map(String) : [],
    updated_at: String(row.updated_at || ''),
    pushed_at: String(row.pushed_at || ''),
    archived: row.archived === true,
    fork: row.fork === true
  };
}

function normalizeIssue(row) {
  if (!row || row.pull_request) return null;
  return {
    number: Number(row.number || 0),
    title: String(row.title || '').trim().slice(0, 200),
    url: String(row.html_url || ''),
    comments: Number(row.comments || 0),
    state: String(row.state || ''),
    labels: Array.isArray(row.labels) ? row.labels.map(function (l) { return String((l && l.name) || ''); }).filter(Boolean).slice(0, 5) : []
  };
}

export async function onRequestPost(context) {
  let body = {};
  try { body = await context.request.json(); } catch (e) { return json(400, { error: 'bad_json' }); }

  const action = String(body.action || 'search').trim();
  if (action !== 'search' && action !== 'repo') return json(400, { error: 'bad_action' });

  const token = String(body.token || context.request.headers.get('x-github-token') || '').trim();
  if (token && token.length < 10) return json(400, { error: 'bad_github_token' });

  const params = body.params && typeof body.params === 'object' ? body.params : {};

  if (action === 'search') {
    const query = String(params.query || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!query) return json(400, { error: 'missing_query' });
    const limit = Math.min(20, Math.max(1, Number(params.limit) || 10));
    const path = '/search/repositories?q=' + encodeURIComponent(query) + '&sort=stars&order=desc&per_page=' + limit;
    let result;
    try {
      result = await githubFetch(path, token);
    } catch (err) {
      return json(/abort|timeout/i.test(String(err && err.message)) ? 504 : 502, {
        error: /abort|timeout/i.test(String(err && err.message)) ? 'github_timeout' : 'github_network_error'
      });
    }
    if (!result.resp.ok) return providerError(result.resp, result.data);
    const items = (result.data && Array.isArray(result.data.items)) ? result.data.items : [];
    const repos = items.map(normalizeRepo).filter(Boolean);
    return json(200, {
      ok: true,
      action: 'search',
      query: query,
      repos: repos,
      count: repos.length,
      total_count: Number((result.data && result.data.total_count) || 0),
      rate: rateInfo(result.resp)
    });
  }

  const fullName = String(params.full_name || '').trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName)) return json(400, { error: 'bad_repo' });
  const repoPath = '/repos/' + fullName.split('/').map(encodeURIComponent).join('/');
  const results = await Promise.allSettled([
    githubFetch(repoPath + '/readme', token, 'application/vnd.github.raw+json'),
    githubFetch(repoPath + '/issues?state=open&sort=updated&direction=desc&per_page=8', token)
  ]);

  let readme = '';
  let issues = [];
  let firstError = null;
  let networkError = null;
  let rate = null;

  const readmeResult = results[0].status === 'fulfilled' ? results[0].value : null;
  if (results[0].status === 'rejected') networkError = results[0].reason;
  if (readmeResult) {
    rate = rateInfo(readmeResult.resp) || rate;
    if (readmeResult.resp.ok) readme = String(readmeResult.text || '').slice(0, 7000);
    else if (readmeResult.resp.status !== 404) firstError = readmeResult;
  }

  const issuesResult = results[1].status === 'fulfilled' ? results[1].value : null;
  if (results[1].status === 'rejected') networkError = networkError || results[1].reason;
  if (issuesResult) {
    rate = rateInfo(issuesResult.resp) || rate;
    if (issuesResult.resp.ok) {
      const rows = Array.isArray(issuesResult.data) ? issuesResult.data : [];
      issues = rows.map(normalizeIssue).filter(Boolean).slice(0, 8);
    } else if (issuesResult.resp.status !== 404) firstError = firstError || issuesResult;
  }

  if (firstError) return providerError(firstError.resp, firstError.data);
  if (!readmeResult && !issuesResult) {
    const text = String(networkError && networkError.message || networkError || '');
    return json(/abort|timeout/i.test(text) ? 504 : 502, {
      error: /abort|timeout/i.test(text) ? 'github_timeout' : 'github_network_error'
    });
  }
  if (!readme && !issues.length) {
    return json(404, { error: 'repo_empty', detail: '没有读到 README 或 open issue' });
  }

  return json(200, {
    ok: true,
    action: 'repo',
    full_name: fullName,
    readme: readme,
    issues: issues,
    rate: rate
  });
}
