"""
Generate a diagram for the Planner → plan JSON → Executor branching.

Outputs: diagrams/output/multi_agent_planner.svg
"""

from pathlib import Path
from graphviz import Digraph


def build_diagram(output_dir: str = "diagrams/output", file_format: str = "svg") -> Path:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    dot = Digraph(name="MultiAgentPlanner", filename="multi_agent_planner", format=file_format)
    dot.attr(rankdir="LR", fontname="Inter, Helvetica, Arial", fontsize="12")

    dot.node("input", "User question + short history", shape="parallelogram")
    dot.node("planner", "Planner (small model)", shape="box")
    dot.node(
        "plan_json",
        '{\n  "kind": "simple" | "tool",\n  "tools": ["math_eval", ...],\n  "notes": "..."\n}',
        shape="note",
    )
    dot.node("decision", "kind == 'simple'?", shape="diamond")
    dot.node("simple", "Simple completion", shape="box", style="rounded")
    dot.node("tool_exec", "Executor with tools", shape="box")
    dot.node("tool_list", "Tool list from plan", shape="note")
    dot.node("complete", "Complete", shape="Msquare")

    dot.edges([
        ("input", "planner"),
        ("planner", "plan_json"),
        ("plan_json", "decision"),
        ("decision", "simple"),
        ("decision", "tool_exec"),
        ("tool_exec", "tool_list"),
        ("simple", "complete"),
        ("tool_exec", "complete"),
    ])

    rendered_path = Path(dot.render(directory=str(output_path), cleanup=True))
    return rendered_path


if __name__ == "__main__":
    result = build_diagram()
    print(f"Wrote: {result}")


