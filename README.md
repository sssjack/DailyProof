# DailyProof

DailyProof 是一个面向月度目标、每日打卡、倒计时执行、刷题记录和管理者总览的计划系统。

## 当前能力

- 每日计划分为 `事项` 和 `刷题` 两类，两类都支持打勾完成。
- 事项任务可一键完成，也可倒计时执行。
- 刷题任务完成时必须填写刷题量、正确率和用时分钟数。
- 刷题标签支持资料分析、数量关系、言语理解、图推、判断推理、政治理论、常识。
- 数据中心按日、周、月、总维度统计刷题量、正确率、用时趋势和标签分布。
- 管理后台可查看多用户完成率、刷题量、平均正确率和刷题结果明细。

## 默认账号

- 管理员：`admin@dailyproof.cn` / `DailyProof@2026`
- 体验用户：`demo@dailyproof.cn` / `Demo@2026`

## 本地运行

```bash
cd frontend
npm install
npm run build
cd ..

set DATABASE_URL=sqlite:///./data/dailyproof.sqlite3
set JWT_SECRET=local-dailyproof-secret
set PYTHONPATH=%cd%\backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

访问 `http://localhost:8000/DailyProof`。

## Docker 部署

```bash
cp .env.example .env
docker compose up -d --build
```

应用默认监听宿主机 `8091`，Nginx 将 `/DailyProof` 反代到 `http://127.0.0.1:8091`。
