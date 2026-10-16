.PHONY: check check-py check-web fmt test-core dev up

# One command for every gate. Pre-commit, the Claude Stop hook and CI all call this.
check: check-py check-web

check-py:
	uv run ruff format --check .
	uv run ruff check .
	uv run pyright
	uv run lint-imports
	uv run vulture
	uv run pytest --cov --cov-report=term-missing

check-web:
	cd web && pnpm typecheck && pnpm lint && pnpm test && pnpm dead

fmt:
	uv run ruff format .
	uv run ruff check --fix .

test-core:
	uv run pytest core

dev:
	uv run uvicorn cadent_api.main:app --reload & cd web && pnpm dev

up:
	cd web && pnpm build
	docker compose up --build -d
