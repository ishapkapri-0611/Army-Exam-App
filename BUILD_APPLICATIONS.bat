@echo off
echo ========================================
echo    BUILDING ARMY EXAM APPLICATIONS
echo ========================================
echo.
echo This will create standalone .exe files for deployment
echo.
pause

echo Installing build dependencies...
echo.

echo Building Invigilator Application...
cd invigilatorApp
call npm install
call npm run build
cd ..

echo.
echo Building Candidate Application...
cd candidateApp
call npm install
call npm run build
cd ..

echo.
echo ========================================
echo           BUILD COMPLETE!
echo ========================================
echo.
echo Built applications are in:
echo - dist/invigilator/ (Invigilator App)
echo - dist/candidate/ (Candidate App)
echo.
echo You will find:
echo - Setup installers (.exe)
echo - Portable executables (.exe)
echo.
pause