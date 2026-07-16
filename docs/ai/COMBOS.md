# 9Router Combo Mapping

## Analysis

Agents:

- planning
- pm
- ba
- architect

Recommended fallback order:

1. `kr/claude-sonnet-4.5-thinking`
2. `cx/gpt-5.5`
3. `kr/glm-5-thinking`
4. `kr/deepseek-3.2-thinking`

Do not use invalid or unavailable Kiro model IDs.

## Implementation

Agents:

- delivery
- backend
- frontend

Recommended fallback order:

1. `cx/gpt-5.5`
2. `kr/claude-sonnet-4.5-thinking-agentic`
3. `kr/qwen3-coder-next-agentic`
4. `kr/deepseek-3.2-agentic`
5. `kr/minimax-m2.5-agentic`

## Quality

Agents:

- qa
- reviewer

Recommended fallback order:

1. `cx/gpt-5.5-review`
2. `kr/claude-sonnet-4.5-thinking`
3. `cx/gpt-5.4-mini-review`
4. `kr/deepseek-3.2-thinking`

## Verification

Agent:

- verifier

Recommended fallback order:

1. `cx/gpt-5.6-sol-review`
2. `cx/gpt-5.5-review`
3. `kr/claude-sonnet-4.5-thinking`
4. `kr/glm-5-thinking`

## Validation

Before adding a model to a combo:

```fish
curl -s http://127.0.0.1:20127/v1/models |
    jq -r '.data[].id' |
    sort
```

Only use IDs returned by the running 9Router instance.
