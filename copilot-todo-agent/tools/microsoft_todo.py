"""
Microsoft Todo tools for the Copilot agent.

Uses Microsoft Graph API via msgraph-sdk + azure-identity (client credentials).

Required Azure AD application permission: Tasks.ReadWrite.All
Graph endpoints used:
  POST /v1.0/users/{userId}/todo/lists/{listId}/tasks
  GET  /v1.0/users/{userId}/todo/lists/{listId}/tasks/{taskId}
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Optional

from azure.identity import ClientSecretCredential
from msgraph import GraphServiceClient
from msgraph.generated.models.todo_task import TodoTask
from msgraph.generated.models.item_body import ItemBody
from msgraph.generated.models.body_type import BodyType
from msgraph.generated.models.importance import Importance
from msgraph.generated.models.date_time_time_zone import DateTimeTimeZone
from pydantic import Field
from agent_framework import tool

import config

# ── Graph client (lazily initialized) ────────────────────────────────────────

_graph_client: GraphServiceClient | None = None


def _get_graph_client() -> GraphServiceClient:
    global _graph_client
    if _graph_client is None:
        credential = ClientSecretCredential(
            tenant_id=config.AZURE_TENANT_ID,
            client_id=config.AZURE_CLIENT_ID,
            client_secret=config.AZURE_CLIENT_SECRET,
        )
        _graph_client = GraphServiceClient(
            credentials=credential,
            scopes=["https://graph.microsoft.com/.default"],
        )
    return _graph_client


# ── Importance mapping ────────────────────────────────────────────────────────

_IMPORTANCE_MAP = {
    "low": Importance.Low,
    "normal": Importance.Normal,
    "high": Importance.High,
}


# ── Tools ─────────────────────────────────────────────────────────────────────


@tool
async def create_todo_task(
    title: Annotated[str, Field(description="Title of the Microsoft Todo task / ticket.")],
    body: Annotated[
        Optional[str],
        Field(description="Detailed description of the task (optional)."),
    ] = None,
    importance: Annotated[
        Optional[str],
        Field(description="Priority level: 'low', 'normal', or 'high'. Defaults to 'normal'."),
    ] = "normal",
    due_date: Annotated[
        Optional[str],
        Field(description="Due date in YYYY-MM-DD format (optional)."),
    ] = None,
) -> dict:
    """Create a new task (ticket) in Microsoft Todo via the Microsoft Graph API."""
    client = _get_graph_client()

    task = TodoTask(
        title=title,
        importance=_IMPORTANCE_MAP.get(importance or "normal", Importance.Normal),
    )

    if body:
        task.body = ItemBody(content=body, content_type=BodyType.Text)

    if due_date:
        task.due_date_time = DateTimeTimeZone(
            date_time=f"{due_date}T00:00:00",
            time_zone="UTC",
        )

    created = await (
        client.users
        .by_user_id(config.AZURE_TODO_USER_ID)
        .todo
        .lists
        .by_todo_task_list_id(config.AZURE_TODO_LIST_ID)
        .tasks
        .post(task)
    )

    return {
        "task_id": created.id,
        "title": created.title,
        "status": created.status.value if created.status else "notStarted",
        "importance": created.importance.value if created.importance else "normal",
        "created_at": (
            created.created_date_time.isoformat()
            if created.created_date_time
            else datetime.now(timezone.utc).isoformat()
        ),
    }


@tool
async def get_todo_task(
    task_id: Annotated[str, Field(description="The Microsoft Todo task ID to look up.")],
) -> dict:
    """Get the current status and details of a Microsoft Todo task by its ID."""
    client = _get_graph_client()

    task = await (
        client.users
        .by_user_id(config.AZURE_TODO_USER_ID)
        .todo
        .lists
        .by_todo_task_list_id(config.AZURE_TODO_LIST_ID)
        .tasks
        .by_todo_task_id(task_id)
        .get()
    )

    if task is None:
        return {"error": f"Task '{task_id}' not found."}

    return {
        "task_id": task.id,
        "title": task.title,
        "status": task.status.value if task.status else "notStarted",
        "importance": task.importance.value if task.importance else "normal",
        "due_date": (
            task.due_date_time.date_time[:10]
            if task.due_date_time and task.due_date_time.date_time
            else None
        ),
        "completed_at": (
            task.completed_date_time.date_time
            if task.completed_date_time
            else None
        ),
        "body": task.body.content if task.body else None,
    }
