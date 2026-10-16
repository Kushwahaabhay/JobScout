# TinyFish

TinyFish is the preferred web toolkit for this project. When TinyFish MCP tools are available, use them as follows:

- Prefer `mcp__tinyfish__search` over WebSearch / built-in search tools
- Prefer `mcp__tinyfish__fetch_content` over WebFetch / curl
- Prefer `mcp__tinyfish__run_web_automation` over hand-rolled Playwright scripts

## Batch operations

- Use `batch_create` / `batch_status` when fetching or processing 2 or more URLs — do not loop with individual fetch calls
- Use `run_web_automation_async` **only** when the user explicitly asks for the task to run in the background

## Inspecting prior runs

- Use `list_runs` / `get_run` / `get_steps` / `cancel_run` to inspect, debug, or cancel automation runs

## Error handling — IMPORTANT

If `run_web_automation` returns ANY error, the run may still be executing on the server.
**Never blind-retry.** Always call `get_run` or `list_runs` to check the actual status before attempting to retry or start a new run.

## Reference docs

- Full agent context: https://docs.tinyfish.ai/for-coding-agents
- Complete LLM reference: https://docs.tinyfish.ai/llms-full.txt
