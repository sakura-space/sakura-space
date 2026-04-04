"""
Entry point for the Copilot Todo Agent.

Two modes (select with --mode):

  cli      (default) — interactive REPL: chat with the agent directly from
                        the terminal. Useful for local testing without
                        Copilot Studio credentials.

  copilot  — connects to a published Copilot Studio agent via
              agent-framework-copilotstudio and streams its response.
              Requires COPILOTSTUDIOAGENT__* env vars to be set.

Usage:
  python main.py                  # cli mode
  python main.py --mode cli
  python main.py --mode copilot --message "Create a task: fix the login bug"
"""

import asyncio
import argparse
import os

# config must be imported first — it calls load_dotenv()
import config  # noqa: F401


# ── CLI mode ──────────────────────────────────────────────────────────────────


async def run_cli() -> None:
    from agent_framework import AgentThread
    from agent import build_agent

    agent = build_agent()
    thread = AgentThread()

    print("CopilotTodoAgent — CLI mode  (type 'exit' to quit)\n")
    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye.")
            break

        if not user_input:
            continue
        if user_input.lower() in ("exit", "quit"):
            print("Goodbye.")
            break

        result = await agent.run(user_input, thread=thread)
        print(f"Agent: {result}\n")


# ── Copilot Studio mode ───────────────────────────────────────────────────────


async def run_copilot(message: str) -> None:
    from agent_framework.microsoft import CopilotStudioAgent, acquire_token
    from microsoft_agents.copilotstudio.client import (
        ConnectionSettings,
        CopilotClient,
        PowerPlatformCloud,
        AgentType,
    )

    token = acquire_token(
        client_id=config.AZURE_CLIENT_ID,
        tenant_id=config.AZURE_TENANT_ID,
    )

    settings = ConnectionSettings(
        environment_id=os.environ["COPILOTSTUDIOAGENT__ENVIRONMENTID"],
        agent_identifier=os.environ["COPILOTSTUDIOAGENT__SCHEMANAME"],
        cloud=PowerPlatformCloud.PROD,
        copilot_agent_type=AgentType.PUBLISHED,
        custom_power_platform_cloud=None,
    )

    copilot = CopilotStudioAgent(
        client=CopilotClient(settings=settings, token=token)
    )

    print(f"Sending to Copilot Studio: {message!r}\n")
    print("Agent: ", end="", flush=True)
    async for chunk in copilot.run_stream(message):
        if chunk.text:
            print(chunk.text, end="", flush=True)
    print()


# ── Entry point ───────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(description="Copilot Todo Agent")
    parser.add_argument(
        "--mode",
        choices=["cli", "copilot"],
        default="cli",
        help="Run mode: 'cli' for interactive terminal, 'copilot' to connect to Copilot Studio",
    )
    parser.add_argument(
        "--message",
        default="Hello! What can you help me with?",
        help="Message to send in copilot mode (ignored in cli mode)",
    )
    args = parser.parse_args()

    if args.mode == "cli":
        asyncio.run(run_cli())
    else:
        asyncio.run(run_copilot(args.message))


if __name__ == "__main__":
    main()
