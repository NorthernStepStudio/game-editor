import os
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

EMBEDDING_DIM = int(os.environ.get("MATTERHORN_MEMORY_EMBEDDING_DIM", "1024"))
os.environ["EMBEDDING_DIM"] = str(EMBEDDING_DIM)
os.environ.setdefault("GRAPHITI_TELEMETRY_ENABLED", "false")

import sys

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

from graphiti_core import Graphiti
from graphiti_core.cross_encoder.bge_reranker_client import BGERerankerClient
from graphiti_core.embedder import OpenAIEmbedder, OpenAIEmbedderConfig
from graphiti_core.llm_client import LLMConfig
from graphiti_core.llm_client.openai_generic_client import OpenAIGenericClient
from graphiti_core.nodes import EpisodeType, Node


def _required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required.")
    return value


def _model_endpoint(name: str) -> str:
    value = _required(name)
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https"):
        raise RuntimeError(f"{name} must use HTTP or HTTPS.")
    host = (parsed.hostname or "").lower()
    local = host in {"127.0.0.1", "localhost", "::1"}
    if not local and os.environ.get("MATTERHORN_MEMORY_ALLOW_REMOTE_MODELS") != "1":
        raise RuntimeError(
            f"{name} must be loopback unless MATTERHORN_MEMORY_ALLOW_REMOTE_MODELS=1 is explicitly set."
        )
    return value.rstrip("/")


LLM_BASE_URL = _model_endpoint("MATTERHORN_MEMORY_LLM_BASE_URL")
LLM_MODEL = _required("MATTERHORN_MEMORY_LLM_MODEL")
EMBEDDING_BASE_URL = _model_endpoint("MATTERHORN_MEMORY_EMBEDDING_BASE_URL")
EMBEDDING_MODEL = _required("MATTERHORN_MEMORY_EMBEDDING_MODEL")
API_KEY = os.environ.get("MATTERHORN_MEMORY_API_KEY", "matterhorn-local")
DB_PATH = Path(
    os.environ.get(
        "MATTERHORN_MEMORY_DB_PATH",
        str(Path.home() / ".matterhorn" / "project-memory.db"),
    )
).expanduser().resolve()
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# Embedded graph engine. FalkorDB Lite ships no Windows build, so Windows defaults to Kuzu.
GRAPH_ENGINE = os.environ.get(
    "MATTERHORN_MEMORY_GRAPH_ENGINE",
    "kuzu" if sys.platform == "win32" else "falkordblite",
).strip().lower()
if GRAPH_ENGINE not in ("kuzu", "falkordblite"):
    raise RuntimeError("MATTERHORN_MEMORY_GRAPH_ENGINE must be 'kuzu' or 'falkordblite'.")


def _graph_driver():
    if GRAPH_ENGINE == "kuzu":
        from graphiti_core.driver.kuzu_driver import KuzuDriver

        return KuzuDriver(db=str(DB_PATH.with_suffix(".kuzu")))
    from graphiti_core.driver.falkordb_driver import FalkorDriver
    from redislite.async_falkordb_client import AsyncFalkorDB

    return FalkorDriver(falkor_db=AsyncFalkorDB(dbfilename=str(DB_PATH)))


class MemoryMessage(BaseModel):
    uuid: str = Field(min_length=1, max_length=200)
    name: str = Field(min_length=1, max_length=500)
    role_type: Literal["user", "assistant", "system"]
    role: str | None = Field(default=None, max_length=200)
    content: str = Field(min_length=1, max_length=50_000)
    timestamp: datetime
    source_description: str = Field(min_length=1, max_length=500)


class AddMessagesRequest(BaseModel):
    group_id: str = Field(pattern=r"^matterhorn-project-[A-Za-z0-9_-]{1,80}$")
    messages: list[MemoryMessage] = Field(min_length=1, max_length=25)


class SearchRequest(BaseModel):
    group_ids: list[str] = Field(min_length=1, max_length=25)
    query: str = Field(min_length=1, max_length=8_000)
    max_facts: int = Field(default=10, ge=1, le=50)


def _validate_groups(groups: list[str]) -> None:
    for group in groups:
        if not group.startswith("matterhorn-project-") or len(group) > 100:
            raise HTTPException(status_code=400, detail="Invalid Matterhorn project-memory group.")


def _fact(edge) -> dict:
    return {
        "uuid": edge.uuid,
        "name": edge.name,
        "fact": edge.fact,
        "valid_at": edge.valid_at,
        "invalid_at": edge.invalid_at,
        "created_at": edge.created_at,
        "expired_at": edge.expired_at,
        "source_node_uuid": edge.source_node_uuid,
        "target_node_uuid": edge.target_node_uuid,
        "episodes": edge.episodes or [],
    }


graphiti: Graphiti | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global graphiti
    driver = _graph_driver()

    llm = OpenAIGenericClient(
        config=LLMConfig(
            api_key=API_KEY,
            model=LLM_MODEL,
            small_model=LLM_MODEL,
            base_url=LLM_BASE_URL,
            temperature=0.1,
        )
    )
    embedder = OpenAIEmbedder(
        config=OpenAIEmbedderConfig(
            api_key=API_KEY,
            base_url=EMBEDDING_BASE_URL,
            embedding_model=EMBEDDING_MODEL,
            embedding_dim=EMBEDDING_DIM,
        )
    )
    reranker = BGERerankerClient()

    graphiti = Graphiti(
        graph_driver=driver,
        llm_client=llm,
        embedder=embedder,
        cross_encoder=reranker,
    )
    await graphiti.build_indices_and_constraints()
    try:
        yield
    finally:
        if graphiti is not None:
            await graphiti.close()
        graphiti = None


app = FastAPI(
    title="Matterhorn Project Memory",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)


def _memory() -> Graphiti:
    if graphiti is None:
        raise HTTPException(status_code=503, detail="Matterhorn Project Memory is starting.")
    return graphiti


@app.get("/healthcheck")
async def healthcheck():
    memory = _memory()
    try:
        if hasattr(memory.driver, "health_check"):
            await memory.driver.health_check()
        else:
            # Kuzu's Graphiti driver has no health_check; a trivial query proves the database answers.
            await memory.driver.execute_query("RETURN 1")
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Project-memory database is unavailable.") from exc
    return {"status": "healthy", "service": "Matterhorn Project Memory"}


@app.post("/messages", status_code=status.HTTP_202_ACCEPTED)
async def add_messages(request: AddMessagesRequest):
    memory = _memory()
    for message in request.messages:
        await memory.add_episode(
            uuid=message.uuid,
            group_id=request.group_id,
            name=message.name,
            episode_body=f"{message.role or ''}({message.role_type}): {message.content}",
            reference_time=message.timestamp,
            source=EpisodeType.message,
            source_description=message.source_description,
        )
    return {"accepted": True, "count": len(request.messages)}


@app.post("/search")
async def search_memory(request: SearchRequest):
    _validate_groups(request.group_ids)
    memory = _memory()
    edges = await memory.search(
        group_ids=request.group_ids,
        query=request.query,
        num_results=request.max_facts,
    )
    return {"facts": [_fact(edge) for edge in edges]}


@app.delete("/group/{group_id}")
async def forget_project(group_id: str):
    _validate_groups([group_id])
    memory = _memory()
    await Node.delete_by_group_id(memory.driver, group_id)
    return {"deleted": True, "group_id": group_id}
