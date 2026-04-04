"""
Agent definition — builds the CopilotTodoAgent using Microsoft Agent Framework.

LLM backend: Azure OpenAI (configured via environment variables)
Tools:
  - create_todo_task  — creates a ticket in Microsoft Todo
  - get_todo_task     — retrieves the status of an existing ticket
"""

import config  # loads .env via load_dotenv()
from agent_framework import Agent
from agent_framework.openai import OpenAIChatClient
from azure.identity import ClientSecretCredential

from tools.microsoft_todo import create_todo_task, get_todo_task

_INSTRUCTIONS = """You are a helpful assistant that manages task tracking via Microsoft Todo.

Your capabilities:
- Create a new task/ticket in Microsoft Todo when a user reports an issue or requests tracking
- Check the status of an existing task by its task ID

Guidelines:
- When creating a task, always confirm back to the user with the task ID and title
- Use importance='high' for urgent issues, 'normal' for standard requests, 'low' for minor items
- If the user asks about a task, use get_todo_task to fetch its current status
- Keep responses concise and action-oriented
"""


def build_agent() -> Agent:
    """Construct and return the configured CopilotTodoAgent."""
    credential = ClientSecretCredential(
        tenant_id=config.AZURE_TENANT_ID,
        client_id=config.AZURE_CLIENT_ID,
        client_secret=config.AZURE_CLIENT_SECRET,
    )

    client = OpenAIChatClient(
        model=config.AZURE_OPENAI_DEPLOYMENT,
        azure_endpoint=config.AZURE_OPENAI_ENDPOINT,
        api_version=config.AZURE_OPENAI_API_VERSION,
        credential=credential,
    )

    return Agent(
        client=client,
        name="CopilotTodoAgent",
        instructions=_INSTRUCTIONS,
        tools=[create_todo_task, get_todo_task],
    )
