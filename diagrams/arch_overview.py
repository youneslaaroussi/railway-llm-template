"""
Generate a high-level monorepo architecture diagram.

Outputs: diagrams/output/monorepo_overview.svg

Diagram highlights:
- Monorepo root → `server` (NestJS API) and `site` (Next.js UI)
- Server: Agent controller/service, Tool registry, Tools (memory, currency, math eval tutorial)
- Site: Chat UI, web worker, components
- External: OpenAI API, optional Redis (Upstash)
"""

from pathlib import Path
from graphviz import Digraph


def build_diagram(output_dir: str = "diagrams/output", file_format: str = "svg") -> Path:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    dot = Digraph(
        name="MonorepoOverview",
        filename="monorepo_overview",
        format=file_format,
    )
    dot.attr(rankdir="LR", fontname="Inter, Helvetica, Arial", fontsize="12")

    # External services
    dot.node("openai", "OpenAI API", shape="component", style="filled", fillcolor="#EEE6FF")
    dot.node("redis", "Redis (Upstash, optional)", shape="cylinder", style="dashed")

    # Server cluster
    with dot.subgraph(name="cluster_server") as server:
        server.attr(label="server/ (NestJS API)", style="filled", color="#f8f9fa")
        server.node("agent_controller", "AgentController", shape="box")
        server.node("agent_service", "AgentService", shape="box")
        server.node("tool_registry", "ToolRegistry", shape="box")
        server.node("tool_memory", "Tool: memory", shape="box", style="rounded")
        server.node("tool_currency", "Tool: currency", shape="box", style="rounded")
        server.node("tool_math", "Tool: math_eval (tutorial)", shape="box", style="rounded")
        server.node(
            "endpoints",
            "Endpoints:\nPOST /agent/chat\nPOST /agent/chat/stream\nGET /healthcheck\nGET /api, /reference",
            shape="note",
        )

        server.edges([
            ("agent_controller", "agent_service"),
            ("agent_service", "tool_registry"),
            ("tool_registry", "tool_memory"),
            ("tool_registry", "tool_currency"),
            ("tool_registry", "tool_math"),
        ])

    # Site cluster
    with dot.subgraph(name="cluster_site") as site:
        site.attr(label="site/ (Next.js UI)", style="filled", color="#f8f9fa")
        site.node("next_app", "Next.js App", shape="box")
        site.node("chat_ui", "Chat UI", shape="box", style="rounded")
        site.node("worker", "Worker: chat.worker.ts", shape="box")
        site.node("components", "Components:\nChat interface\nTool call blocks\nMemory manager", shape="note")
        site.edges([("next_app", "chat_ui"), ("chat_ui", "worker")])

    # Interactions
    dot.edge("worker", "agent_controller", label="POST /agent/chat/stream", style="bold")
    dot.edge("agent_service", "openai", style="dashed")
    dot.edge("agent_service", "redis", style="dashed", label="cache / rate-limit")

    rendered_path = Path(dot.render(directory=str(output_path), cleanup=True))
    return rendered_path


if __name__ == "__main__":
    result = build_diagram()
    print(f"Wrote: {result}")


