from fastapi import APIRouter

from app.config import settings
from app.models.schemas import AskRequest, AskResponse
from app.services.deterministic import ask_offline
from app.services.llm import ask_with_llm

router = APIRouter()


@router.post("/ask", response_model=AskResponse)
async def ask(body: AskRequest):
    question = body.question.strip()
    if not question:
        return AskResponse(answer="Please ask a question.", toolUsed=None)
    if settings.ai_api_key:
        return AskResponse(**await ask_with_llm(question, body.user.role))
    return AskResponse(**await ask_offline(question))
