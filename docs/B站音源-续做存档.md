# 小手机 · B站音源续做存档

更新时间：2026-11-23  
仓库：`https://github.com/winter078/yanyanji.git`（分支 `main`）  
本地目录：`C:\Users\29531\phone-dev\latest`  
线上入口：`https://momo-phone.pages.dev/phone`  
当前线上 build：`20261123-0073`（B站前端最后改动停在 0069 时的代码，后续没有单独验收）

## 一句话结论

前端搜索合并、B站结果展示、点歌播放、刷新后保留，这几步已经做完；真正卡住的是**服务器去 B站拿数据时被风控 412**，公共中转现在也不稳定。下次不要重做前端，先决定走哪条通道。

## 已完成

- 一起听搜索里加入 B站音源：网易云结果 + B站结果一起显示，提交 `45aa941`。
- B站结果可以点，点了才播放，不会自动播；播放状态刷新后仍在。
- 后端已有三个正式函数：
  - `functions/api/bili/search.js`：按关键词搜 B站视频，过滤掉太短/太长的结果，最多 10 条。
  - `functions/api/bili/play.js`：用 bvid/cid 取播放地址，支持匿名指纹 `buvid3`，也支持环境变量 `BILI_COOKIE` 提高画质。
  - `functions/api/bili/stream.js`：同源转发 B站视频流，解决手机端 Referer/CORS 问题。
- 直连失败时改走公共中转 `api.cors.lol`，提交 `ac54f7f`。

## 卡点（截至 2026-11-23 实测）

- Cloudflare Pages 出站访问 `api.bilibili.com` 被判 `-412 request was banned`；云主机同样 412。
- 本机 Windows PowerShell 在**不带 Origin、Referer 设为 `https://www.bilibili.com/`** 时可以 200，说明 B站认来源，不是单纯封 IP。
- B站 JSONP 要求 Referer 在 `.bilibili.com` 下，浏览器页面在 `momo-phone.pages.dev`，伪造不了；`fetch` 的 `referrer` 选项实测无效。
- 公共中转 `api.cors.lol` 曾成功一次，之后持续 429；其他试过的中转多为 401/403/412/429/522/530。
- B站真实播放流还没验收；`/api/bili/stream` 从 Cloudflare 拉 `bilivideo.com` 是否 200/206 未知；官方播放器直接打开能播，嵌 iframe 在本地测试黑屏。

## 可选的下一步

1. **第三方 B站 API**：`api.oanor.com` 需要 `x-oanor-key`，免费额度约 3100 次/月、2 req/s；`xiaoapi.cn` 也需要 key。用户目前没有 key，需要先决定是否用。
2. **自建中转**：找一台没被 B站拉黑的住宅/机房出口，做一个只转发搜索、详情、播放地址的小服务；稳定但要维护，也要防止被滥用。
3. **先做“粘贴 B站链接播放”**：不做搜索，用户自己贴 BV 号/链接，后端只负责取流；最快能用，但不如搜索顺手。
4. **继续公共中转**：不推荐，当前 429 太多，线上会时好时坏。

## 关键测试素材

- 视频：`BV1BZbSzZEGT`，`cid=31268997329`，标题《晴天》Hi-Res，UP `VV音乐局`，4:30。
- 官方播放器：
  `https://player.bilibili.com/player.html?bvid=BV1BZbSzZEGT&autoplay=0&danmaku=0&high_quality=1`
- 搜索原始接口：
  `https://api.bilibili.com/x/web-interface/search/type?search_type=video&page=1&keyword=...`
- 临时探测函数 `functions/api/bili/probe.js` ~ `probe20.js` 还在仓库/线上，收尾时应清理。

## 续做边界

- 不自动播放；必须用户自己点搜索结果。
- 不改动已上线的音乐曲库、红心补回、播放模式、收听分钟逻辑。
- 刷新后 B站结果/播放状态要保留。
- 不把 `_probe_*.html`、`_deploy`、临时探测函数混进正式提交。
- 改完先本地真机/浏览器验证，再 bump build 上线；线上验证用 `curl.exe --ssl-no-revoke`。
- 对用户解释时少用术语，用“B站认来源、不认我们的服务器”这种生活化说法。

## 下次直接发回的提示词

把下面整段复制发回即可：

> 继续小手机（`C:\Users\29531\phone-dev\latest`）的 B站音源，先读项目里的《B站音源-续做存档》。前端搜索合并、结果展示、点歌播放、刷新保留已经做完，不要重做；音乐侧曲库/红心/播放模式/收听分钟也已经上线，不要碰。现在卡在服务器访问 B站被 412 风控，公共中转不稳定。请先给我 2-3 条可执行路线和取舍（第三方 API key、自建中转、粘贴链接播放），我选一条你再动手。选第三方 key 时，先告诉我怎么申请、免费额度、要不要填环境变量；选自建中转时，先给我最小部署方案和成本。做完必须验证：搜索有结果、点了才播放、刷新还在、真实播放流能拖动；不要自动播放，不要提交临时探测文件。
