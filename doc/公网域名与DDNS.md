# 公网域名与 DDNS

## 当前状态

- 域名：`nasbot.cloud`
- DNSPod 记录：`@ A 101.71.198.79`，TTL `600`
- 当前公网出口：杭州联通动态公网 IP `101.71.198.79`
- 飞牛 NAS：`192.168.8.152`
- GL 路由 LAN 网关：`192.168.8.1`
- GL 路由 WAN 地址：`192.168.5.2`
- 上级中兴路由/光猫：`192.168.5.1`

## 已验证入口

- 飞牛 NAS：`http://nasbot.cloud/`
- 飞牛 HTTPS：`https://nasbot.cloud:5667/`
- WechatOnCloud 生产面板：`http://nasbot.cloud:36080/`
- WechatOnCloud 测试面板公网：`http://nasbot.cloud:36081/`
- WechatOnCloud 测试面板内网：`http://192.168.8.152:36081/`
- WechatOnCloud 测试面板 GL WAN 侧：`http://192.168.5.2:36081/`

## 公网端口规则

当前公网访问链路是两层转发：

```text
公网 80    -> 上级中兴路由 -> 192.168.5.2:80    -> GL 路由 -> 192.168.8.152:5666
公网 36080 -> 上级中兴路由 -> 192.168.5.2:36080 -> GL 路由 -> 192.168.8.152:36080
公网 36081 -> 上级中兴路由 -> 192.168.5.2:36081 -> GL 路由 -> 192.168.8.152:36081
```

其中 `36081` 已在上级中兴路由/光猫新增规则：

```text
WechatOnCloud-Test-36081
TCP WAN 36081 -> LAN 192.168.5.2:36081
```

`http://nasbot.cloud:36081/` 已验证返回 `200`。

## DDNS 状态

使用 `ddns-go` 常驻在飞牛 NAS 上，定时检测真实公网 IP，并自动更新 DNSPod 的 `nasbot.cloud` A 记录。

Compose 模板：

```text
fnos/ddns-go.compose.yml
```

启动后访问：

```text
http://192.168.8.152:9876/
```

当前已配置：

- DNS 服务商：DNSPod
- 域名：`nasbot.cloud`
- 记录类型：`A`
- 主机记录：`@`
- IPv4 获取方式：`http://members.3322.org/dyndns/getip`，备用 `https://ip.3322.net`、`https://myip.ipip.net`
- IPv6：关闭
- Deny from WAN：开启
- NAS 本地管理地址：`http://192.168.8.152:9876/`
- 同步频率：使用 `ddns-go` 默认值，每 `5` 分钟检测一次；如果公网 IP 变化，会自动更新 DNSPod A 记录

常用公网 IP 检测接口：

```text
http://members.3322.org/dyndns/getip
https://myip.ipip.net
https://cip.cc
```

注意：不能使用会走代理的 IP 接口，否则会把代理出口写进 DNS。`https://members.3322.org/dyndns/getip` 的证书已过期，当前使用 HTTP 版本。`ddns-go` 日志已确认识别到真实公网 IP `101.71.198.79`，并判断 `nasbot.cloud` 当前记录一致。

只要 NAS 和 `ddns-go` 容器持续运行，杭州联通动态公网 IP 后续变化时，`ddns-go` 会在下一次检测周期内把 `nasbot.cloud` 更新到新的公网 IP，不需要手动登录 DNSPod 修改记录。

## 启动命令

在飞牛 Docker/Compose 面板导入 `fnos/ddns-go.compose.yml`，或通过 SSH 在仓库目录运行：

```bash
docker compose -f fnos/ddns-go.compose.yml up -d
```

`ddns-go` Web UI 中已填入 DNSPod Token。Token 属于可长期修改 DNS 的凭据，不应写入仓库或文档。
