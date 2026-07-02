# 党务材料扫码登记系统

原生微信小程序 + 微信云开发项目，用于集中管理党务相关材料的领取、回收和台账统计。

## 功能

- 材料创建与台账
- 唯一 `material_id`
- 扫码入口：`/pages/scan/scan?material_id=...`
- 领取登记
- 回收登记
- 自动匹配领取和回收
- 待领取、待回收、已回收统计
- 操作流水留痕

## 项目结构

```text
miniprogram/              小程序端
cloudfunctions/           微信云函数
api/                      Vercel API
project.config.json       微信开发者工具项目配置
vercel.json               Vercel 部署配置
AGENTS.md                 Codex 项目约定
```

## 使用方式

1. 用微信开发者工具打开本目录。
2. 如果没有小程序 AppID，可以先使用游客模式编译运行，项目会自动进入本地演示模式。
3. 本地演示模式使用开发者工具本地缓存保存材料和流转记录，适合先看 UI、跑通流程。
4. 如果已有真实小程序 AppID，开通并选择云开发环境。
5. 创建集合：`materials`、`circulation_records`、`batches`、`users`、`admins`。
6. 上传并部署所有云函数。
7. 编译运行小程序。
8. 云开发模式下，首次进入小程序的人会自动成为初始化管理员。

## 无 AppID 演示模式

当项目 AppID 是 `touristappid`，或当前环境无法使用 `wx.cloud` 时，小程序会自动使用本地演示模式。

本地演示模式支持：

- 新增材料
- 查看材料详情
- 打开扫码登记页
- 确认领取
- 确认回收
- 统计看板
- 待回收清单

数据保存在微信开发者工具的本地缓存中，正式部署前仍需切换到真实 AppID 和云开发。

## 双模式

小程序分为两种使用模式：

- 老师端：显示材料台账、统计看板、新增材料、材料详情和完整流转记录。
- 学生端：只显示材料登记入口和当前扫码材料的领取/回收表单，不显示全量台账和统计。

本地/Vercel 调试时，老师端首页可点击“学生端”切换到学生模式；学生端可点击“切换到老师端”返回老师模式。正式上线时应将该调试切换替换为真实登录和 `admins` 权限判断。

## Vercel 后端模式

域名审批前可以先使用 Vercel 的 `*.vercel.app` 地址跑通多人共享数据链路。

### 1. 准备数据库

在 Vercel Marketplace 添加 Neon Postgres，或使用已有 Postgres，并配置环境变量：

```text
DATABASE_URL=postgres://...
```

API 首次请求会自动创建表：

- `materials`
- `circulation_records`

### 2. 部署 Vercel

```bash
npm install
npx vercel
```

部署后会得到类似：

```text
https://dangwushouji-xxx.vercel.app
```

当前项目已绑定：

```text
romanrose.xyz
www.romanrose.xyz
api.romanrose.xyz
```

在阿里云/万网 DNS 中添加：

```text
A    @      76.76.21.21
A    www    76.76.21.21
A    api    76.76.21.21
```

### 3. 配置小程序请求地址

编辑：

```text
miniprogram/config.js
```

填入：

```js
module.exports = {
  vercelApiBaseUrl: 'https://api.romanrose.xyz'
}
```

微信开发者工具本地调试时，需要在「详情 -> 本地设置」勾选：

```text
不校验合法域名、web-view 域名、TLS 版本以及 HTTPS 证书
```

正式发布时，再把备案后的自有域名配置到微信公众平台的 request 合法域名。

### 4. Vercel API

小程序调用：

```text
POST /api/rpc
```

请求体：

```json
{
  "name": "materialCreate",
  "data": {}
}
```

当前支持：

- `login`
- `materialCreate`
- `materialGet`
- `materialReceive`
- `materialReturn`
- `dashboardStats`

## 数据权限建议

开发期可先使用云函数读写数据库。上线前建议将核心集合设为“仅云函数可读写”，避免客户端直接修改台账。

## 核心状态

```text
pending_receive -> received -> returned
```

所有领取和回收都通过同一个 `material_id` 匹配。老师端发布材料后默认是 `pending_receive`（待领取）；学生扫码领取时选择“待回收”会进入 `received`（待回收），选择“无需回收”会直接完成为 `returned`（已回收），并留下领取和无需回收两条流水。
