"""
Generate diagrams for the multi-stage Docker builds (server and site).

Outputs: diagrams/output/docker_multistage.svg

Covers:
- server/Dockerfile: deps → build → prod
- site/Dockerfile: deps → build → prod
"""

from pathlib import Path
from graphviz import Digraph


def build_diagram(output_dir: str = "diagrams/output", file_format: str = "svg") -> Path:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    dot = Digraph(name="DockerMultistage", filename="docker_multistage", format=file_format)
    dot.attr(rankdir="LR", fontname="Inter, Helvetica, Arial", fontsize="12")

    with dot.subgraph(name="cluster_server") as server:
        server.attr(label="server/Dockerfile", style="filled", color="#f8f9fa")
        server.node("s_deps", "deps\nnode:22-alpine\n`npm ci --omit=dev`", shape="box")
        server.node("s_build", "build\ncopy src + node_modules\n`npm run build`", shape="box")
        server.node("s_prod", "prod\ncopy dist + node_modules\n`node dist/main`", shape="box")
        server.edges([("s_deps", "s_build"), ("s_build", "s_prod")])

    with dot.subgraph(name="cluster_site") as site:
        site.attr(label="site/Dockerfile", style="filled", color="#f8f9fa")
        site.node("w_deps", "deps\nnode:22-alpine\n`npm ci`", shape="box")
        site.node("w_build", "build\ncopy src + node_modules\n`npm run build`", shape="box")
        site.node("w_prod", "prod\ncopy .next + public\n`npm start`", shape="box")
        site.edges([("w_deps", "w_build"), ("w_build", "w_prod")])

    rendered_path = Path(dot.render(directory=str(output_path), cleanup=True))
    return rendered_path


if __name__ == "__main__":
    result = build_diagram()
    print(f"Wrote: {result}")


