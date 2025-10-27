@echo off
echo Creating desktop shortcuts for Army Exam System...
echo.

set CURRENT_DIR=%~dp0

echo Creating Invigilator App shortcut...
powershell "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\Army Exam - Invigilator.lnk'); $Shortcut.TargetPath = '%CURRENT_DIR%START_INVIGILATOR_APP.bat'; $Shortcut.WorkingDirectory = '%CURRENT_DIR%'; $Shortcut.IconLocation = '%CURRENT_DIR%invigilatorApp\src\renderer\assets\icon.ico'; $Shortcut.Description = 'Army Exam Invigilator Application'; $Shortcut.Save()"

echo Creating Candidate App shortcut...
powershell "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\Army Exam - Candidate.lnk'); $Shortcut.TargetPath = '%CURRENT_DIR%START_CANDIDATE_APP.bat'; $Shortcut.WorkingDirectory = '%CURRENT_DIR%'; $Shortcut.IconLocation = '%CURRENT_DIR%candidateApp\src\renderer\assets\icon.ico'; $Shortcut.Description = 'Army Exam Candidate Application'; $Shortcut.Save()"

echo.
echo Desktop shortcuts created successfully!
echo.
echo You can now use:
echo - "Army Exam - Invigilator" shortcut for exam management
echo - "Army Exam - Candidate" shortcut for taking exams
echo.
pause