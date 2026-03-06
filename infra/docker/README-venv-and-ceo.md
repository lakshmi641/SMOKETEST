# Quick reference: venv and CEO agent

## Activate venv from `infra/docker`

The project venv is at the **repo root**, not in `infra/docker`. Use one of:

```powershell
# Option 1: Go to repo root, then activate
cd "c:\Users\Lakshmi S\smoke-test\pms"
.\.venv\Scripts\Activate.ps1

# Option 2: Activate from infra/docker using relative path
cd "c:\Users\Lakshmi S\smoke-test\pms\infra\docker"
..\..\.venv\Scripts\Activate.ps1
```

## Start CEO agent and see why it exits

From `infra/docker`:

```powershell
# Start CEO agent in foreground (see logs and errors)
docker compose up ceo-agent
```

Leave this running; you’ll see any import or startup error. Ctrl+C to stop.

To run in background and then check status:

```powershell
docker compose up -d ceo-agent
docker compose ps -a
docker logs ceo_agent
```

If the CEO agent container is not in the list, run:

```powershell
docker compose build ceo-agent
docker compose up -d ceo-agent
```
