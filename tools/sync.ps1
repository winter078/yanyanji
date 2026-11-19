# 小手机仓库同步脚本（家 / 公司共用）
# 用法：
#   .\sync.ps1           只看差异，不动文件
#   .\sync.ps1 pull      把 GitHub main 上的最新版拉到本地（开工前先跑这个）
#   .\sync.ps1 push      把本地改过的文件推上去（收工前跑，消息用 -Msg "说明"）
# 令牌从 gh 的钥匙串里现取，本机不再留明文令牌文件。

param(
  [ValidateSet('status', 'pull', 'push')]
  [string]$Mode = 'status',
  [string]$Msg = 'chore: 同步'
)

$Repo = 'winter078/yanyanji'
$Branch = 'main'
$Root = $PSScriptRoot
$Gh = Join-Path $Root 'gh\bin\gh.exe'
if (-not (Test-Path $Gh)) { throw "找不到 gh：$Gh" }
$env:GH_TOKEN = (& $Gh auth token).Trim()
if (-not $env:GH_TOKEN) { throw "gh 未登录，先跑 gh auth login" }
$H = @{ Authorization = "Bearer $env:GH_TOKEN"; 'User-Agent' = 'doubao' }

# 仓库路径 -> 本地路径（相对仓库根的本地副本目录）
$Map = [ordered]@{
  'index.html'                 = 'verify\index.html'
  'manifest.json'              = 'verify\manifest.json'
  'phone.html'                 = 'verify\phone.html'
  'css/music-app.css'          = 'verify\music\music-app.css'
  'css/desktop.css'            = 'verify\desktop\desktop.css'
  'css/music.css'              = 'verify\music\css_music.css'
  'js/media/music-ui.js'       = 'verify\music\music-ui.js'
  'js/media/music.js'          = 'verify\music\music_new.js'
  'js/version-watch.js'        = 'verify\music\version_watch.js'
  'functions/api/version.js'   = 'verify\music\api_version.js'
  'functions/api/music/search.js' = 'verify\music\api_music_search.js'
  'functions/api/music/url.js'    = 'verify\music\api_music_url.js'
  'tools/sync.ps1'             = 'sync.ps1'
}

function Get-Remote($path) {
  $api = "https://api.github.com/repos/$Repo/contents/$($path -replace '/','%2F')?ref=$Branch"
  try { return Invoke-RestMethod -Uri $api -Headers $H -Method Get }
  catch { return $null }
}

$changed = @()
foreach ($kv in $Map.GetEnumerator()) {
  $remote = Get-Remote $kv.Key
  $localPath = Join-Path $Root $kv.Value
  $localExists = Test-Path $localPath
  $localSize = if ($localExists) { (Get-Item $localPath).Length } else { -1 }

  if (-not $remote) {
    if ($localExists) {
      if ($Mode -eq 'push') {
        $api = "https://api.github.com/repos/$Repo/contents/$($kv.Key)"
        $body = @{ message = $Msg; content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($localPath)) }
        $r = Invoke-RestMethod -Uri $api -Headers $H -Method Put -Body ($body | ConvertTo-Json -Compress) -ContentType 'application/json'
        Write-Host "↑ 新增 $($kv.Key) -> $($r.commit.sha.Substring(0,7))"
      }
      else { $changed += "新增待推  $($kv.Key)" }
    }
    continue
  }
  if ($localSize -ne $remote.size) {
    $changed += ("大小不同  {0}  远端 {1} / 本地 {2}" -f $kv.Key, $remote.size, $localSize)
    if ($Mode -eq 'pull') {
      $bytes = [Convert]::FromBase64String($remote.content)
      $dir = Split-Path -Parent $localPath
      if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
      [IO.File]::WriteAllBytes($localPath, $bytes)
      Write-Host "↓ 拉取 $($kv.Key)"
    }
    elseif ($Mode -eq 'push') {
      $api = "https://api.github.com/repos/$Repo/contents/$($kv.Key)"
      $body = @{ message = $Msg; content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($localPath)); sha = $remote.sha }
      $r = Invoke-RestMethod -Uri $api -Headers $H -Method Put -Body ($body | ConvertTo-Json -Compress) -ContentType 'application/json'
      Write-Host "↑ 推送 $($kv.Key) -> $($r.commit.sha.Substring(0,7))"
    }
  }
}

if ($Mode -eq 'pull' -and $changed.Count -eq 0) { "✔ 已是最新（全部与 GitHub $Branch 一致）" }
elseif ($changed.Count -eq 0) { "✔ 本地与 GitHub $Branch 完全一致" }
else {
  if ($Mode -eq 'status') { "以下文件与远端不同（pull 会覆盖本地，push 会上传本地）："; $changed }
  elseif ($Mode -eq 'pull') { "拉取完成，共 $($changed.Count) 个文件" }
  else { "推送完成，共 $($changed.Count) 个文件" }
}
