@echo off
REM Launch Claude Code in the folder where this .bat file is located.
REM Authentication is handled by `claude login` — do NOT put an API key here.
cd /d "%~dp0"
claude %*
