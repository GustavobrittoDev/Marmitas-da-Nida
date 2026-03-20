@echo off
setlocal
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
"C:\Program Files\nodejs\node.exe" node_modules\vite\bin\vite.js --host 0.0.0.0 >> vite.out.log 2>> vite.err.log
