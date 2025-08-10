"""
Generate a diagram of the client streaming receive loop (web worker).

Outputs: diagrams/output/client_stream_loop.svg

Covers:
- fetch POST /agent/chat/stream
- Reader loop with buffer management
- Parse lines starting with 'data: '
- Dispatch by type: content_stream, tool_start, tool_complete, heartbeat, complete
"""

from pathlib import Path
from graphviz import Digraph


def build_diagram(output_dir: str = "diagrams/output", file_format: str = "svg") -> Path:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    dot = Digraph(name="ClientStreamLoop", filename="client_stream_loop", format=file_format)
    dot.attr(rankdir="LR", fontname="Inter, Helvetica, Arial", fontsize="12")

    dot.node("start", "fetch POST\n/agent/chat/stream", shape="parallelogram")
    dot.node("ok", "HTTP ok + body?", shape="diamond")
    dot.node("reader", "reader.read() loop", shape="box")
    dot.node("buffer", "append bytes → decode → split by \n\nkeep tail in buffer", shape="box", style="rounded")
    dot.node("parse", "if line starts with 'data: ' → JSON.parse", shape="box")
    dot.node("dispatch", "dispatch by evt.type:\ncontent_stream | tool_start | tool_complete | heartbeat | complete", shape="note")
    dot.node("update", "UI updates / state changes", shape="box")
    dot.node("finish", "Stream finished", shape="Msquare")
    dot.node("error", "Throw / surface error", shape="octagon")

    dot.edges([
        ("start", "ok"),
        ("ok", "reader"),
        ("reader", "buffer"),
        ("buffer", "parse"),
        ("parse", "dispatch"),
        ("dispatch", "update"),
        ("update", "reader"),
    ])
    dot.edge("ok", "error", label="no", style="dashed")
    dot.edge("reader", "finish", label="done? yes", style="dashed")

    rendered_path = Path(dot.render(directory=str(output_path), cleanup=True))
    return rendered_path


if __name__ == "__main__":
    result = build_diagram()
    print(f"Wrote: {result}")


