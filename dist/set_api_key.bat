@echo off
set /p ODDS_API_KEY="Enter your API Key: "
setx ODDS_API_KEY "%ODDS_API_KEY%"
echo API key set successfully. Please restart the program.
pause
