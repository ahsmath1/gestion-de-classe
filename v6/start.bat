@echo off
setlocal
cd /d "%~dp0"
set PORT=8000
where py >nul 2>&1
if %errorlevel%==0 goto RUN_PY
where python >nul 2>&1
if %errorlevel%==0 goto RUN_PYTHON

echo.
echo Python n'est pas installe ou n'est pas accessible dans PATH.
echo Installe Python 3 depuis https://www.python.org/downloads/windows/ puis relance start.bat.
pause
exit /b 1

:RUN_PY
start "" "http://127.0.0.1:%PORT%/index.html"
py -m http.server %PORT% --bind 127.0.0.1
exit /b

:RUN_PYTHON
start "" "http://127.0.0.1:%PORT%/index.html"
python -m http.server %PORT% --bind 127.0.0.1
exit /b
