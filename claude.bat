@echo off
REM Launch Claude Code in the folder where this .bat file is located
set ANTHROPIC_API_KEY=sk-ant-ВСТАВЬ_СВОЙ_КЛЮЧ_СЮДА
cd /d "%~dp0"
claude %*
