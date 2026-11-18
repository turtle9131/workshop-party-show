@echo off
chcp 65001 > nul
title 워크샵 파티 쇼 서버 (이 창을 닫으면 서버가 꺼집니다)
cd /d "%~dp0"
where node > nul 2> nul
if errorlevel 1 (
  echo.
  echo  [!] Node.js가 설치되어 있지 않아요.
  echo      https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행해 주세요.
  echo.
  pause
  exit /b
)
echo.
echo  잠시 뒤 브라우저가 열립니다. 이 창은 게임이 끝날 때까지 닫지 마세요.
start "" /min cmd /c "timeout /t 2 /nobreak > nul & start http://localhost:8000"
node server.js
echo.
echo  [!] 서버가 멈췄어요. 위의 메시지를 확인해 주세요. (8000번 포트를 다른 프로그램이 쓰고 있을 수 있어요)
pause