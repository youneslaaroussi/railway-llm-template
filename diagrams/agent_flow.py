"""
Generate the Agent Planner → Executor flow diagram (server-side).

Outputs: diagrams/output/agent_flow.svg

Covers:
- Controller → Service → Planner
- Decision: simple vs tool-enabled execution
- Executor iterations with tool calls
- Streamed events: content_stream, tool_start, tool_complete, heartbeat, complete
"""

from pathlib import Path
from graphviz import Digraph


def build_diagram(output_dir: str = "diagrams/output", file_format: str = "svg") -> Path:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    dot = Digraph(name="AgentFlow", filename="agent_flow", format=file_format)
    dot.attr(rankdir="LR", fontname="Inter, Helvetica, Arial", fontsize="12")

    dot.node("client", "Client request\n/agent/chat/stream", shape="parallelogram")
    dot.node("controller", "AgentController", shape="box")
    dot.node("service", "AgentService.processRequest{Stream}", shape="box")
    dot.node("planner", "Planner (small model)", shape="box")
    dot.node("decision", "kind == 'simple'?", shape="diamond")
    dot.node("simple", "Direct completion\n(content_stream)", shape="box", style="rounded")
    dot.node("executor", "Executor (tool-enabled)", shape="box")
    dot.node("tool_registry", "ToolRegistry", shape="box")
    dot.node("tool", "Tool (memory / currency / math)", shape="box", style="rounded")
    dot.node("events", "Streamed events:\ncontent_stream\ntool_start\ntool_complete\nheartbeat\ncomplete", shape="note")
    dot.node("done", "Complete", shape="Msquare")

    dot.edges([
        ("client", "controller"),
        ("controller", "service"),
        ("service", "planner"),
        ("planner", "decision"),
        ("decision", "simple"),
        ("decision", "executor"),
        ("executor", "tool_registry"),
        ("tool_registry", "tool"),
        ("tool", "executor"),
        ("executor", "events"),
        ("simple", "events"),
        ("events", "done"),
    ])

    rendered_path = Path(dot.render(directory=str(output_path), cleanup=True))
    return rendered_path


if __name__ == "__main__":
    result = build_diagram()
    print(f"Wrote: {result}")


