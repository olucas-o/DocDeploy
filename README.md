# DocDeploy

DocDeploy is a portfolio-ready service foundation for document-processing
workflows. It separates a public TypeScript API from an internal Python worker,
keeps secrets outside version control, and includes Docker health checks and CI.

> The repository currently exposes health endpoints only. Add document upload,
> validation, and OpenAI-backed processing behind authenticated routes before
> using it with real customer data.

## Architecture

| Service | Stack | Exposure | Purpose |
| --- | --- | --- | --- |
| `api` | Fastify + TypeScript | `http://localhost:3000` | Public API boundary and health check |
| `worker` | FastAPI + Python | Docker network only | Internal processing service |

There is intentionally no database, Redis, or queue yet. Introduce them only
when the application persists documents, needs retries, or processes jobs
asynchronously.

## Run with Docker

```bash
cp .env.example .env
docker compose up --build
```

Verify the API:

```bash
curl http://localhost:3000/health
```

Stop the stack with `docker compose down`. The worker is reachable from other
containers at `http://worker:8000/health`; it is not published to the host.

## Local development

```bash
cd api
npm install
npm run dev
```

In a second terminal:

```bash
cd worker
python -m venv .venv
# PowerShell: .\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Run the full local quality gate from the repository root:

```bash
npm run verify
```

It type-checks the API, compiles the Python worker, and runs all API and worker
tests. It automatically uses either the root `.venv` or the `worker/.venv`
created above; install the worker requirements there first. In PowerShell
environments that block `npm.ps1`, use `npm.cmd run verify`.
The repository CI runs these checks and builds both images on every push and
pull request.

## Public repository checklist

- Copy `.env.example` to `.env`; never commit a real `OPENAI_API_KEY`.
- Select a license before making the repository public.
- Add a short project screenshot or architecture diagram when product screens
  exist.
- Configure the deployment platform with `OPENAI_API_KEY`, `CORS_ORIGIN`, and
  `API_PORT` as appropriate.
