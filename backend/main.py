import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.aineva import router

app = FastAPI(title="AlpineSnowMap API")

allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
