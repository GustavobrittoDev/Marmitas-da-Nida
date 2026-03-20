@echo off
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
title Marmitas da Nida Dev
"C:\Program Files\nodejs\node.exe" node_modules\vite\bin\vite.js --host 127.0.0.1
