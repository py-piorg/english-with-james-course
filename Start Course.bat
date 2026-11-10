@echo off
title English with James Course
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  echo Starting the course at http://localhost:8765  (close this window to stop)
  start "" http://localhost:8765/index.html
  python -m http.server 8765 --bind 127.0.0.1
) else (
  echo Python was not found, opening the file directly. If videos don't play, use the "Watch on YouTube" link under each video.
  start "" "%~dp0index.html"
)
