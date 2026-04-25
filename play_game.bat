@echo off
cd /d "%~dp0"
start "" "http://localhost:8042/Main.html?v=%random%"
python -m http.server 8042
pause
4/10	Pre-Rendered Buffers (Caching)
