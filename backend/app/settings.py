from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8-sig", extra="ignore")

    app_name: str = "DailyProof"
    env: str = "dev"
    timezone: str = "Asia/Shanghai"
    public_base_url: str = "http://localhost:8000/DailyProof"

    base_path: str = "/DailyProof"
    api_path: str = "/DailyProof/api"
    cors_allow_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:8000,http://127.0.0.1:8000,http://www.clockwise.asia"
    )

    database_url: str = "sqlite:///./data/dailyproof.sqlite3"
    jwt_secret: str = "change-me-dailyproof-secret"
    jwt_expires_minutes: int = 60 * 24 * 14

    default_admin_email: str = "admin@dailyproof.cn"
    default_admin_password: str = "DailyProof@2026"
    default_user_email: str = "demo@dailyproof.cn"
    default_user_password: str = "Demo@2026"

    ai_api_url: str = ""
    ai_api_key: str = ""
    ai_model: str = ""
    deepseek_api_key: str = ""
    deepseek_api_url: str = "https://api.deepseek.com/chat/completions"
    deepseek_model: str = "deepseek-v4-pro"
    ai_http_timeout_sec: int = 45

    @property
    def cors_origins_list(self) -> list[str]:
        raw = (self.cors_allow_origins or "").replace("\n", ",").replace(";", ",")
        origins = [item.strip().rstrip("/") for item in raw.split(",") if item.strip()]
        return ["*"] if "*" in origins and self.env != "prod" else origins


settings = Settings()
