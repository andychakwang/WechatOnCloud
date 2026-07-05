# 飞牛 NAS 自动化测试部署

> 本文用于把 `andy-automation-usable-r38-2026-07-05` 部署成独立测试面板。
> 它不会替换现有 `36080` 生产面板，默认使用 `36081`。

## 当前部署目标

- 生产面板保持不变：`http://nasbot.cloud:36080/`
- 测试面板新开端口：`http://nasbot.cloud:36081/`
- 测试容器名：`woc-panel-automation-test`
- 测试数据目录：`data-panel-automation-test`
- 镜像版本：`ghcr.io/andychakwang/woc-panel:andy-automation-usable-r38-2026-07-05`
- 实例镜像：`ghcr.io/andychakwang/wechat-on-cloud:andy-automation-usable-r38-2026-07-05`

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

它会验证登录、版本接口、自动化配置、自动化预检、缺失素材阻断、接入资料导入、受众资产、素材资产台账、资产包导出/预览/导入、模拟决策、群发受控队列、朋友圈草稿和审计日志；创建出的测试队列会被取消，测试朋友圈草稿会被归档。

如果本地同时设置了 `AUTOMATION_BRIDGE_TOKEN`，smoke 会额外验证 Bridge 资料推送、受众推送、素材台账推送、云端素材映射导出、消息事件推送、带图片路径和素材 key 映射的顺序回复 `replySteps`、worker 心跳、Mac handler dry-run、Bridge runner dry-run、运行报告明细、Bridge 出箱恢复预览、按 worker 与失败原因筛选恢复、cursor 分批继续和 all-target 汇总，并通过 `scripts/wecom-bridge-client.mjs` 验证批准回复、群发任务和朋友圈任务的拉取、领取、释放、失败回写与成功回写接口。

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
