"""
ISEMS Backend Entry Point
This file imports from main.py for backward compatibility with supervisor
"""
from main import app

# Re-export app for uvicorn
__all__ = ['app']
