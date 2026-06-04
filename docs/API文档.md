# DailyProof API 文档

统一前缀：`/DailyProof/api`

## 认证

- `POST /auth/register`：注册普通用户
- `POST /auth/login`：登录
- `GET /me`：当前用户

## 计划

- `GET /plans/monthly?year=2026&month=6`：查询月计划
- `POST /plans/monthly`：创建月计划并拆分每日任务
- `POST /plans/monthly/{plan_id}/generate-days`：重新生成每日计划
- `GET /daily`：查询今天计划
- `GET /daily?day=2026-06-02`：查询指定日期计划
- `PATCH /tasks/{task_id}`：更新任务状态、复盘备注和任务结果
  - 事项任务：`status`、`note`
  - 刷题任务：完成时必须传 `result_question_count`、`result_accuracy`、`result_minutes`

## 统计

- `GET /stats/monthly?year=2026&month=6`：月度汇总，包括完成率、刷题量、平均正确率、刷题用时、日趋势、周统计、标签统计和历史总统计
- `GET /stats/practice?year=2026&month=6`：刷题统计别名，返回结构同月度统计

## 管理

- `GET /admin/overview`：全局指标
- `GET /admin/users`：用户进度
- `GET /admin/results`：刷题结果明细，包含用户、任务、标签、题量、正确率、用时和日期
