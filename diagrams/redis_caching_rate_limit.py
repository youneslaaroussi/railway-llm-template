"""
Generate a diagram for optional Redis usage (caching + rate limits).

Outputs: diagrams/output/redis_caching_rate_limit.svg
"""

from pathlib import Path
from graphviz import Digraph


def build_diagram(output_dir: str = "diagrams/output", file_format: str = "svg") -> Path:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    dot = Digraph(name="RedisCaching", filename="redis_caching_rate_limit", format=file_format)
    dot.attr(rankdir="LR", fontname="Inter, Helvetica, Arial", fontsize="12")

    dot.node("client", "Client requests", shape="parallelogram")
    dot.node("guard", "RateLimitGuard (optional)", shape="diamond")
    dot.node("controller", "AgentController", shape="box")
    dot.node("service", "AgentService", shape="box")
    dot.node("tools", "Tools (memory / currency / math)", shape="box", style="rounded")
    dot.node("redis", "Redis (Upstash)", shape="cylinder")
    dot.node("cache", "Response / tool-result cache (TTL)", shape="note")

    dot.edges([
        ("client", "guard"),
        ("guard", "controller"),
        ("controller", "service"),
        ("service", "tools"),
        ("tools", "service"),
    ])
    dot.edge("service", "redis", label="read/write cache", style="dashed")
    dot.edge("guard", "redis", label="rate-limit counters", style="dashed")
    dot.edge("redis", "cache", style="dotted")

    rendered_path = Path(dot.render(directory=str(output_path), cleanup=True))
    return rendered_path


if __name__ == "__main__":
    result = build_diagram()
    print(f"Wrote: {result}")


