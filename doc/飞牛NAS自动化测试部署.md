# 飞牛 NAS 自动化测试部署

> 本文用于把 `andy-automation-usable-r81-2026-07-06` 部署成独立测试面板。
> 它不会替换现有 `36080` 生产面板，默认使用 `36081`。

## 当前部署目标

- 生产面板保持不变：`http://nasbot.cloud:36080/`
- 测试面板新开端口：`http://nasbot.cloud:36081/`
- 测试容器名：`woc-panel-automation-test`
- 测试数据目录：`data-panel-automation-test`
- 镜像版本：`ghcr.io/andychakwang/woc-panel:andy-automation-usable-r81-2026-07-06`
- 实例镜像：`ghcr.io/andychakwang/wechat-on-cloud:andy-automation-usable-r81-2026-07-06`
- 本版新增：Web「Mac Runner 接入」增加企微 CLI 接入探测，配置模板写入 `WECOM_CLI_EXECUTABLE`，面板可复制 `@wecom/cli` 安装、初始化和授权检查命令，`doctor` 会检查 CLI 安装与授权状态。

## 2026-07-06 R81 更新验收

- GitHub Actions release run `28759156165` 已成功构建并推送 panel / wechat 双镜像。
- `36080` 原版面板保持不变，公网入口仍返回 `200`。
- `36081` 自动化测试面板已通过飞牛 Docker socket helper 更新，公网入口返回 `200`。
- 飞牛 Docker 容器详情已验证 `woc-panel-automation-test` 使用镜像：

  ```text
  ghcr.io/andychakwang/woc-panel:andy-automation-usable-r81-2026-07-06
  ```

- 一次性 helper 容器 `woc-updater-...` 已在更新完成后删除。
- 本版新增企微 CLI 接入探测：Mac Runner 配置模板包含 `WECOM_CLI_EXECUTABLE`，Web 面板提供安装、初始化、授权检查和跳过 CLI 体检命令；`doctor` 可检查 `@wecom/cli` 安装与授权状态。
- 本次公网入口检查：

  ```text
  http://nasbot.cloud:36080/ -> 200
  http://nasbot.cloud:36081/ -> 200
  http://nasbot.cloud:36081/api/auth/me -> 401 {"error":"未登录"}
  ```

  其中 `/api/auth/me` 返回 401 属于未登录预期响应，说明后端 API 正常响应。

## 2026-07-06 R80 更新验收

- GitHub Actions release run `28758586946` 已成功构建并推送 panel / wechat 双镜像。
- `36080` 原版面板保持不变，公网入口仍返回 `200`。
- `36081` 自动化测试面板已通过飞牛 Docker socket helper 更新，公网入口返回 `200`。
- 飞牛 Docker 容器详情已验证 `woc-panel-automation-test` 使用镜像：

  ```text
  ghcr.io/andychakwang/woc-panel:andy-automation-usable-r80-2026-07-06
  ```

- 一次性 helper 容器 `woc-updater-...` 已在更新完成后删除。
- 本版新增 Mac Runner LaunchAgent 控制命令，Web 面板可复制脱敏 dry-run、安装、状态、日志和停用命令；安装脚本会读取 bootstrap 写入的本机 env 文件。
- 本次公网入口检查：

  ```text
  http://nasbot.cloud:36080/ -> 200
  http://nasbot.cloud:36081/ -> 200
  http://nasbot.cloud:36081/api/auth/me -> 401 {"error":"未登录"}
  ```

  其中 `/api/auth/me` 返回 401 属于未登录预期响应，说明后端 API 正常响应。

## 2026-07-06 R79 更新验收

- GitHub Actions release run `28757986372` 已成功构建并推送 panel / wechat 双镜像。
- `36080` 原版面板保持不变，公网入口仍返回 `200`。
- `36081` 自动化测试面板已通过飞牛 Docker socket helper 更新，公网入口返回 `200`。
- 飞牛 Docker 容器详情已验证 `woc-panel-automation-test` 使用镜像：

  ```text
  ghcr.io/andychakwang/woc-panel:andy-automation-usable-r79-2026-07-06
  ```

- 一次性 helper 容器 `woc-updater-...` 已在更新完成后删除。
- 本次公网入口检查：

  ```text
  http://nasbot.cloud:36080/ -> 200
  http://nasbot.cloud:36081/ -> 200
  http://nasbot.cloud:36081/api/auth/me -> 401 {"error":"未登录"}
  ```

  其中 `/api/auth/me` 返回 401 属于未登录预期响应，说明后端 API 正常响应。

## 2026-07-06 R78 更新验收

- `36080` 原版面板保持不变，公网入口仍返回 `200`。
- `36081` 自动化测试面板已通过飞牛 Docker socket helper 更新，公网入口返回 `200`。
- `36081` 当前运行容器 `woc-panel-automation-test` 已在飞牛 Docker 容器详情中验证使用镜像：

  ```text
  ghcr.io/andychakwang/woc-panel:andy-automation-usable-r78-2026-07-06
  ```

- 飞牛 Docker Compose 项目 `woc-automation-test` 的 YAML 配置页已验证为 R78：

  ```text
  ghcr.io/andychakwang/woc-panel:andy-automation-usable-r78-2026-07-06
  ghcr.io/andychakwang/wechat-on-cloud:andy-automation-usable-r78-2026-07-06
  ```

- 更新前 helper 会在项目目录内创建 `docker-compose.yml.bak-<timestamp>` 备份，再写入新 YAML。
- 一次性 helper 容器 `woc-updater-...` 已在更新完成后删除，Docker 容器列表恢复为 27 个容器。
- 本次辅助部署脚本已提交到 GitHub：

  ```text
  1db0bc9 Add fnOS Docker socket upgrade helper
  ```

- 本次公网入口检查：

  ```text
  http://nasbot.cloud:36080/ -> 200
  http://nasbot.cloud:36081/ -> 200
  http://nasbot.cloud:36081/api/auth/me -> 401 {"error":"未登录"}
  ```

  其中 `/api/auth/me` 返回 401 属于未登录预期响应，说明后端 API 正常响应。

## 2026-07-06 R65 初次运行验收（历史）

- `36080` 原版面板保持不变，仍由 `woc-panel` 提供服务，镜像仍为 `ghcr.io/gloridust/woc-panel:1.1.7`。
- `36081` 自动化测试面板已通过飞牛 Docker 项目 `woc-automation-test` 执行 `composeBuild` 重建。
- `36081` 当前运行容器 `woc-panel-automation-test` 已验证使用镜像 `ghcr.io/andychakwang/woc-panel:andy-automation-usable-r65-2026-07-06`。
- 本次部署代码版本：`c63535765278d6ee828524882ada85d91996aa2b`。
- GitHub Actions release run `28749317624` 已成功构建并推送 panel / wechat 双镜像。
- NAS 测试 compose 已在更新前备份为 `/vol1/1000/woc-automation-test/docker-compose.yml.bak-2026-07-05T17-51-35-244Z`。
- 两个公网入口已验证：

  ```text
  http://nasbot.cloud:36080/ -> 200
  http://nasbot.cloud:36081/ -> 200
  ```

- 测试面板登录已验证：

  ```text
  POST /api/auth/login -> 200
  ```

- 测试面板 `/api/version` 已验证：

  ```json
  {
    "current": "andy-automation-usable-r65-2026-07-06",
    "latest": null
  }
  ```

- 新增 Bridge 运行健康摘要接口已验证：

  ```json
  {
    "windowHours": 24,
    "totalRuns": 0,
    "workers": 0,
    "topErrors": 0
  }
  ```

  当前 NAS 测试面板刚重建，尚未有 Mac Bridge worker 上报运行记录，所以运行数为 0 属于预期状态。

- 新增“下一步队列”接口已验证：

  ```text
  GET /api/admin/automation/action-queue?limit=5 -> 200
  ```

- 新增 RPA 运行包接口已验证：

  ```text
  GET /api/admin/automation/rpa-package?target=all&limit=5&format=json&includeSource=0 -> 200
  ```

- RPA 包级 handoff 仍保持可用：

  ```text
  GET /api/admin/automation/rpa-package?target=all&limit=5&format=json&includeSource=0 -> 200
  package.handoff.generatedFrom = automation-rpa-package
  package.handoff 存在
  ```

- 下一步队列 handoff 仍保持可用：

  ```text
  GET /api/admin/automation/action-queue?limit=5 -> 200，返回 handoff.rpa
  ```

- Bridge 状态接口已验证：

  ```text
  GET /api/admin/automation/bridge -> 200
  bridge.runReportEndpoint = /api/automation/bridge/wecom/run-report
  bridge.enabled = false
  ```

  当前 NAS 测试面板已保留自动化 Bridge 配置入口；实际 Mac Bridge worker 上报后，`/api/admin/automation/bridge-runs/summary` 会开始累计运行健康数据。

注意：只修改 NAS 上的 `docker-compose.yml` 不会替换正在运行的容器。飞牛 Docker 项目需要执行一次“构建/重建”（内部对应 `composeBuild`），或用等价的 `docker compose pull && docker compose up -d`，新镜像才会真正生效。仅点“重启”可能仍然使用旧镜像层。

## 飞牛 Docker 面板导入

1. 打开飞牛 Docker 应用：

   ```text
   http://nasbot.cloud/apps/docker/
   ```

2. 登录飞牛 NAS 后，进入 Docker 的 Compose/项目管理。

3. 新建项目，项目名建议：

   ```text
   woc-automation-test
   ```

4. 导入或粘贴仓库里的 compose 文件：

   ```text
   fnos/woc-automation-test/docker-compose.yaml
   ```

5. 启动前先替换管理员初始密码：

   ```yaml
   - PANEL_ADMIN_PASSWORD=REPLACE_WITH_A_STRONG_PASSWORD_BEFORE_START
   ```

   这个密码只在测试面板第一次初始化、`data-panel-automation-test/accounts.json` 还不存在时生效。

6. 如需启用 AI 草稿，填写 OpenAI-compatible 配置：

   ```yaml
   - AUTOMATION_AI_API_KEY=你的Key
   - AUTOMATION_AI_BASE_URL=https://api.openai.com/v1
   - AUTOMATION_AI_MODEL=gpt-4o-mini
   ```

7. 如需让企业微信自动化 Mac 版直接推送 FAQ、话术、名单和素材台账，填写 Bridge token：

   ```yaml
   - AUTOMATION_BRIDGE_TOKEN=至少16位随机字符串
   ```

   这个 token 只允许导入接入资料/受众/素材台账、写入新消息事件、拉取已批准回复、群发任务和朋友圈任务，并回写本机处理状态；不允许云端直接发送消息。未设置时 Bridge API 默认关闭。

8. 启动项目，等待镜像拉取完成。

9. 验证测试面板：

   ```bash
   curl -I http://nasbot.cloud:36081/
   ```

   浏览器打开：

   ```text
   http://nasbot.cloud:36081/
   ```

10. 后续升级测试版时，先确认 compose 中的镜像 tag 已更新，再在飞牛 Docker 的 `woc-automation-test` 项目里执行“构建/重建”。完成后用 `/api/version` 验证 `current` 是否等于目标 tag。

## SSH 一键部署

如果飞牛 NAS 开启了 SSH，可以不走网页面板。先设置测试面板初始密码，再执行：

```bash
PANEL_ADMIN_PASSWORD='替换成强密码' \
SSH_TARGET='admin@192.168.8.152' \
./scripts/deploy-fnos-automation-test-ssh.sh
```

可选参数：

```bash
REMOTE_DIR='woc-automation-test'
AUTOMATION_AI_API_KEY='你的Key'
AUTOMATION_AI_BASE_URL='https://api.openai.com/v1'
AUTOMATION_AI_MODEL='gpt-4o-mini'
AUTOMATION_BRIDGE_TOKEN='至少16位随机字符串'
```

正式连接 NAS 前，可以先本地预检渲染后的 Compose：

```bash
PANEL_ADMIN_PASSWORD='替换成强密码' \
./scripts/deploy-fnos-automation-test-ssh.sh --dry-run
```

这个脚本只创建/更新测试项目 `woc-panel-automation-test`，不会改动现有 `36080` 生产面板。

## 无 SSH 的 Docker socket helper 更新

如果飞牛 NAS 的 SSH 无法免密登录，但 `woc-panel-automation-test` 仍能打开终端，可以在该容器终端里启动一次性 helper。helper 会通过挂载的 `/var/run/docker.sock`：

- 读取当前测试容器配置，不读取生产容器。
- 备份 `woc-automation-test` 项目目录下的 compose 文件。
- 拉取目标 panel / wechat 镜像。
- 重建 `woc-panel-automation-test`，保留原数据目录、端口、账号和环境变量。
- 成功后删除旧备份容器；失败时回滚旧容器。

推荐用提交哈希固定脚本来源：

```bash
WOC_VERSION=andy-automation-usable-r81-2026-07-06 \
WOC_ALLOWED_HOSTS=nasbot.cloud \
node /tmp/fnos-docker-socket-upgrade-container.mjs
```

也可以先从 GitHub 下载脚本到 `/tmp` 后再运行。脚本路径：

```text
scripts/fnos-docker-socket-upgrade-container.mjs
```

## 部署入口检查

如果不确定当前是卡在网页登录、SSH、端口转发还是测试容器未启动，可以先跑：

```bash
./scripts/check-fnos-deploy-readiness.sh
```

它会检查：

- 内网生产面板 `192.168.8.152:36080`
- 内网测试面板 `192.168.8.152:36081`
- 上级路由地址 `192.168.5.2`
- 公网域名 `nasbot.cloud`
- 飞牛 Web / Docker 应用入口
- SSH 端口与本机免密登录是否可用

## 首次验收

1. 用 `admin` 和你刚设置的密码登录测试面板。
2. 新建一个测试微信实例并扫码登录。
3. 打开管理页的「自动化工作台」。
4. 先点「实例自检」，确认剪贴板、`xdotool`、窗口状态正常。
5. AI 回复：先用「读取选中文本」或手动输入客户消息生成 AI 草稿。
6. 群发：新建一个只包含测试联系人/测试群的队列，先手动确认发送下一条。
7. 朋友圈：先用「复制到实例剪贴板」模式验证，不直接发布。

也可以先跑一条不触发真实发送/发布的后台 smoke：

```bash
PANEL_URL='http://192.168.8.152:36081' \
PANEL_USER='admin' \
PANEL_PASSWORD='测试面板密码' \
./scripts/smoke-automation-panel.sh
```

它会验证登录、版本接口、自动化配置、自动化预检、缺失素材阻断、接入资料导入、受众资产、按受众筛选生成群发队列、素材资产台账、资产包导出/预览/导入、模拟决策、群发受控队列、朋友圈草稿和审计日志；创建出的测试队列会被取消，测试朋友圈草稿会被归档。

如果本地同时设置了 `AUTOMATION_BRIDGE_TOKEN`，smoke 会额外验证 Bridge 资料推送、受众推送、素材台账推送、云端素材映射导出、Runner 自动同步素材映射并随心跳上报 mapped/skipped 状态、消息事件推送、带图片路径和素材 key 映射的顺序回复 `replySteps`、worker 心跳、Mac Runner 接入体检、企微 CLI 探测和体检回传、Mac handler dry-run、Mac handler 目标窗口校验快照、回复/群发发送前目标硬校验拦截、Bridge 自动回复 send 模式冷却拦截、Bridge client 交付校验门禁、Bridge runner dry-run、带目标会话/OCR 校验快照的运行报告明细、Bridge 出箱恢复预览、按 worker/失败原因/失败冷却/重试上限筛选恢复、cursor 分批继续和 all-target 汇总，并通过 `scripts/wecom-bridge-client.mjs` 验证批准回复、群发任务和朋友圈任务的拉取、领取、释放、失败回写与成功回写接口。

## 回滚与清理

测试版和生产版隔离。需要停掉测试版时，只停止或删除以下项目即可：

```text
woc-automation-test
```

如需保留测试面板账号、规则、审计和实例记录，不要删除：

```text
data-panel-automation-test
```

如需彻底清理测试数据，再删除该目录/卷。

## 注意

- 不要把测试面板的 `36081` 反代到生产域名根路径；先直接用端口验证。
- 不要复用生产 `data-panel`，否则会混用用户、实例元数据和自动化配置。
- `docker.sock` 挂载等同宿主 Docker 管理权限，只应让可信管理员访问测试面板。
