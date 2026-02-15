"""
Helper Utilities
"""
from typing import Any

def parse_float(value: Any, default: float = 0.0) -> float:
    """Safely parse float from any value"""
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (ValueError, TypeError):
        return default
