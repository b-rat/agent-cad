from fastapi import APIRouter

router = APIRouter(prefix="/api")


@router.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
