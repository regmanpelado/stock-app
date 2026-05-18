from fastapi import APIRouter, Query
from app.services import news_service

router = APIRouter(prefix="/news", tags=["news"])


@router.get("/")
async def get_news(limit: int = Query(60, ge=1, le=100)):
    return await news_service.get_news(limit)


@router.get("/sources")
def get_sources():
    return news_service.get_sources()
