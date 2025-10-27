@echo off
echo ========================================
echo   BUILDING PORTABLE ARMY EXAM APPS
echo ========================================
echo.
echo This will create portable .exe files that don't need installation
echo.
pause

echo Installing build dependencies...
echo.

echo Building Portable Invigilator Application...
cd invigilatorApp
call npm install
call npm run build-portable
cd ..

echo.
echo Building Portable Candidate Application...
cd candidateApp
call npm install
call npm run build-portable
cd ..

echo.
echo ========================================
echo        PORTABLE BUILD COMPLETE!
echo ========================================
echo.
echo Portable applications are in:
echo - dist/invigilator/Army-Exam-Invigilator-Portable.exe
echo - dist/candidate/Army-Exam-Candidate-Portable.exe
echo.
echo These can be run directly without installation!
echo.
pause