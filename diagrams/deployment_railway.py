"""
Generate a deployment topology diagram for Railway.

Outputs: diagrams/output/deployment_railway.svg

Covers:
- Two services: API (server) and Web (site)
- Clients connect via internet
- Web → API; API ↔ OpenAI; API ↔ optional Redis (Upstash)
- Independent scaling of services
"""

from pathlib import Path
from graphviz import Digraph


def build_diagram(output_dir: str = "diagrams/output", file_format: str = "svg") -> Path:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    dot = Digraph(name="DeploymentRailway", filename="deployment_railway", format=file_format)
    dot.attr(rankdir="LR", fontname="Inter, Helvetica, Arial", fontsize="12")

    dot.node("internet", "Internet / Users", shape="cloud")
    dot.node("openai", "OpenAI API", shape="component", style="filled", fillcolor="#EEE6FF")
    dot.node("redis", "Redis (Upstash)\noptional", shape="cylinder", style="dashed")

    with dot.subgraph(name="cluster_railway") as railway:
        railway.attr(label="Railway", style="filled", color="#f1f3f5")
        with railway.subgraph(name="cluster_api") as api:
            api.attr(label="API service (server)")
            api.node("api", "NestJS API\n/agent/chat, /agent/chat/stream", shape="box")
        with railway.subgraph(name="cluster_web") as web:
            web.attr(label="Web service (site)")
            web.node("web", "Next.js App", shape="box")

    dot.edge("internet", "web", label="HTTPS")
    dot.edge("internet", "api", label="HTTPS (direct)", style="dashed")
    dot.edge("web", "api", label="HTTP(S)")
    dot.edge("api", "openai", style="dashed")
    dot.edge("api", "redis", label="cache / rate-limit", style="dashed")

    rendered_path = Path(dot.render(directory=str(output_path), cleanup=True))
    return rendered_path


if __name__ == "__main__":
    result = build_diagram()
    print(f"Wrote: {result}")


