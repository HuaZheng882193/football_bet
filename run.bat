@echo off
cd /d "C:\Users\huazh\Desktop\Coding\ClaudeCode\football-odds"

:start
set sport_key=
set /p sport_key=press enter for sport key.......
    python main.py 
pause
goto start
