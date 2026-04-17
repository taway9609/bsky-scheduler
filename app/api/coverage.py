from fastapi import APIRouter, Response, Request
from fastapi.responses import JSONResponse
import json
import os
from collections import defaultdict

router = APIRouter(prefix="/coverage", tags=["coverage"])

COVERAGE_FILE = "/app/coverage_data.json"


def _load_from_file():
    try:
        if os.path.exists(COVERAGE_FILE):
            with open(COVERAGE_FILE, "r") as f:
                return json.load(f)
    except:
        pass
    return {}


def _save_to_file(data):
    try:
        with open(COVERAGE_FILE, "w") as f:
            json.dump(data, f)
    except:
        pass


@router.get("/report")
async def get_coverage_report():
    data = _load_from_file()
    total_apis = len(data)
    total_requests = sum(len(paths) for paths in data.values())
    
    return {
        "status": "success",
        "data": {
            "total_api_groups": total_apis,
            "total_requests": total_requests,
            "apis_tested": data
        }
    }


@router.get("/paths")
async def get_tested_paths():
    data = _load_from_file()
    all_paths = []
    for api_group, paths in data.items():
        for path in paths:
            all_paths.append(f"{api_group} {path}")
    
    return {
        "status": "success",
        "data": {
            "tested_paths": sorted(all_paths),
            "count": len(all_paths)
        }
    }


@router.post("/reset")
async def reset_coverage_endpoint():
    try:
        if os.path.exists(COVERAGE_FILE):
            os.remove(COVERAGE_FILE)
    except:
        pass
    return {"status": "success", "message": "Coverage reset"}


@router.get("/stats")
async def get_coverage_stats():
    data = _load_from_file()
    api_stats = {}
    for api_group, paths in data.items():
        api_stats[api_group] = {
            "paths_tested": len(paths),
            "paths": sorted(list(paths))
        }
    
    return {
        "status": "success",
        "data": {
            "api_groups": api_stats,
            "total_api_groups": len(api_stats),
            "total_unique_paths": sum(len(paths) for paths in data.values())
        }
    }


def record_request(method: str, path: str):
    data = _load_from_file()
    group = method.upper()
    if group not in data:
        data[group] = []
    if path not in data[group]:
        data[group].append(path)
    _save_to_file(data)
