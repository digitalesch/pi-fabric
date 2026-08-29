#!/usr/bin/env python3

import json
import sys
import time

import needle


def build_tool(schema: dict):
    def extract_result(**kwargs):
        return kwargs

    extract_result.__name__ = "extract_result"
    extract_result.__doc__ = "Return the structured result extracted from the input."

    # Needle's @tool decorator turns the Python signature into a schema.
    # We can't dynamically create the signature easily, so attach the
    # caller-provided JSON schema directly.
    extract_result._needle_tool = {
        "name": "extract_result",
        "description": "Return the structured result extracted from the input.",
        "parameters": schema,
    }

    return extract_result


def handle(request: dict) -> dict:
    task_id = request.get("taskId")

    started = time.perf_counter()

    try:
        schema = request.get("outputSchema", {})

        objective = request.get("input", {}).get("objective")
        aspect = request.get("aspect")
        context = request.get("context", {})

        prompt = f"""
Use the extract_result tool to complete this task.

Task:
{aspect}

Objective:
{objective}

Context:
{json.dumps(context)}

Return the requested information using the extract_result tool.
"""

        tool = build_tool(schema)

        agent = needle.Needle(
            tools=[tool],
        )

        response = agent.complete(
            prompt,
            max_new_tokens=128,
        )

        calls = response.get("function_calls") or []

        latency_ms = round(
            (time.perf_counter() - started) * 1000,
            2,
        )

        metadata = {
            "model": "needle",
            "confidence": response.get("confidence"),
            "latencyMs": latency_ms,
        }

        if not calls:
            return {
                "taskId": task_id,
                "success": False,
                "output": None,
                "error": {
                    "code": "EMPTY_RESULT",
                    "message": "Needle returned no structured result",
                },
                "metadata": metadata,
            }

        result = calls[0].get("arguments") or {}

        return {
            "taskId": task_id,
            "success": True,
            "output": result,
            "metadata": metadata,
        }

    except Exception as error:
        latency_ms = round(
            (time.perf_counter() - started) * 1000,
            2,
        )

        return {
            "taskId": task_id,
            "success": False,
            "output": None,
            "error": {
                "code": "WORKER_ERROR",
                "message": str(error),
            },
            "metadata": {
                "model": "needle",
                "latencyMs": latency_ms,
            },
        }


def main() -> None:
    for line in sys.stdin:
        line = line.strip()

        if not line:
            continue

        try:
            request = json.loads(line)
            response = handle(request)

        except Exception as error:
            response = {
                "taskId": None,
                "success": False,
                "output": None,
                "error": {
                    "code": "WORKER_ERROR",
                    "message": str(error),
                },
            }

        print(
            json.dumps(response),
            flush=True,
        )


if __name__ == "__main__":
    main()