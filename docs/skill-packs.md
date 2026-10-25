# Skill packs

Skill packs are versioned markdown instructions that add task-specific guidance without changing the fixed platform or task rules.

## Data

`skill_packs`:

- `slug` — stable unique key.
- `name` — admin label.
- `scope` — `global`, `business_type`, `template`, `task` or `language`.
- `scope_value` — the business type, template slug, task id or language code.
- `status` — `draft`, `active` or `archived`.
- `active_version_id` — the version used by the composer.
- `priority` — higher wins when the 3,000-token budget is tight.

`skill_pack_versions`:

- `version` — integer, unique per pack.
- `content` — markdown, maximum 20,000 characters.
- `size_tokens` — optional stored estimate.
- `eval_result` and `eval_passed` — evaluation metadata.
- Versions are immutable; a trigger blocks update and delete.

## Authoring

- Start with the outcome, then the constraints.
- Use short examples, not long essays.
- Never repeat the platform rules.
- Never include personal data, secrets, prices, awards or claims.
- Do not tell the model to ignore the platform rules.
- Keep a pack under roughly 1,500 tokens so several packs fit.
- State the scope in the first line.
- Prefer checklists over prose.

## Selection

The composer loads active packs for:

- `global`
- `task` matching the task id
- `language` matching the website language
- `business_type` matching the website's business type, when known
- `template` matching the template slug, when known

Packs are sorted by priority. The composer includes whole packs until the 3,000-token skill budget is reached. A pack that does not fit is dropped whole.

## Lifecycle

1. Create a draft pack and version.
2. Lint the markdown and preview the composed prompt.
3. Run the evaluation set.
4. Activate only when `eval_passed` is true, or with a documented override.
5. Roll back by activating an older version.

## Linter rules

- Maximum 20,000 characters.
- No `{{` or `}}`.
- No HTML.
- No secrets or email addresses.
- No instruction to reveal the system prompt.
- No claim that a fact is true unless it is a placeholder instruction.
- Warn when a pack is over 1,500 estimated tokens.

## Still to build

- Admin editor and preview.
- Linter.
- Evaluation runner.
- Seed packs.
