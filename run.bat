@echo off
cd /d "D:\Coding\football_bet"

:start
set sport_key=
set /p sport_key=press enter for sport key.......
    python main.py 
pause
goto start
