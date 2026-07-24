"""Persistent single-GPU job queue for five-view stylized head reconstruction."""

from __future__ import annotations

import json
import os
import re
import subprocess
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any


JOB_ID_PATTERN = re.compile(r"^head-[0-9]{10}-[a-f0-9]{12}$")
ASSET_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")


def _write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temporary, path)


class NerfHeadJobService:
    def __init__(
        self,
        root: Path | None = None,
        conda_executable: Path | None = None,
        environment_name: str = "AvatarNerf",
        runner_path: Path | None = None,
    ) -> None:
        self.root = root or Path.home() / "avatar-nerf-jobs"
        self.root.mkdir(parents=True, exist_ok=True)
        self.conda_executable = conda_executable or Path.home() / "anaconda3" / "bin" / "conda"
        self.environment_name = environment_name
        self.runner_path = runner_path or Path(__file__).with_name("nerf_head_pipeline_impl.py")
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="avatar-nerf-gpu")
        self._lock = threading.Lock()

    def create_job(self, request_payload: dict[str, Any]) -> dict[str, Any]:
        job_id = f"head-{int(time.time())}-{uuid.uuid4().hex[:12]}"
        job_dir = self.root / job_id
        job_dir.mkdir(parents=True, exist_ok=False)
        _write_json_atomic(job_dir / "request.json", {**request_payload, "jobId": job_id})
        initial = {
            "jobId": job_id,
            "status": "queued",
            "stage": "queued",
            "progress": 0.0,
            "createdAt": time.time(),
        }
        _write_json_atomic(job_dir / "status.json", initial)
        self._executor.submit(self._run_job, job_id)
        return initial

    def get_job(self, job_id: str) -> dict[str, Any]:
        job_dir = self.get_job_dir(job_id)
        status_path = job_dir / "status.json"
        if not status_path.exists():
            raise FileNotFoundError(job_id)
        return json.loads(status_path.read_text(encoding="utf-8"))

    def get_asset(self, job_id: str, filename: str) -> Path:
        if not ASSET_NAME_PATTERN.fullmatch(filename):
            raise ValueError("invalid_asset_name")
        path = self.get_job_dir(job_id) / "export" / filename
        if not path.is_file():
            raise FileNotFoundError(filename)
        return path

    def get_job_dir(self, job_id: str) -> Path:
        if not JOB_ID_PATTERN.fullmatch(job_id):
            raise ValueError("invalid_job_id")
        path = self.root / job_id
        if not path.is_dir():
            raise FileNotFoundError(job_id)
        return path

    def _run_job(self, job_id: str) -> None:
        job_dir = self.root / job_id
        log_path = job_dir / "pipeline.log"
        command = [
            str(self.conda_executable),
            "run",
            "--no-capture-output",
            "-n",
            self.environment_name,
            "python",
            str(self.runner_path),
            "--job-dir",
            str(job_dir),
        ]
        with self._lock, log_path.open("a", encoding="utf-8") as log:
            log.write(f"[JobService] command={' '.join(command)}\n")
            log.flush()
            try:
                completed = subprocess.run(
                    command,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                    check=False,
                    text=True,
                    env={
                        **os.environ,
                        "PYTHONUNBUFFERED": "1",
                        "PYTHONNOUSERSITE": "1",
                    },
                )
                status = self.get_job(job_id)
                if completed.returncode != 0 and status.get("status") != "failed":
                    _write_json_atomic(
                        job_dir / "status.json",
                        {
                            **status,
                            "status": "failed",
                            "stage": status.get("stage", "failed"),
                            "failureReason": f"gpu_runner_exit_{completed.returncode}",
                            "validationErrors": ["see_pipeline_log"],
                            "finishedAt": time.time(),
                        },
                    )
            except Exception as error:
                _write_json_atomic(
                    job_dir / "status.json",
                    {
                        "jobId": job_id,
                        "status": "failed",
                        "stage": "failed",
                        "progress": 0.0,
                        "failureReason": str(error),
                        "validationErrors": ["job_service_exception"],
                        "finishedAt": time.time(),
                    },
                )
