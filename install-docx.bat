@echo off
echo Installing docx package for Word document export...
echo.

cd invigilatorApp
echo Installing in invigilatorApp directory...
npm install docx@9.5.1

echo.
echo Installation complete!
echo.
echo You can now use Word document export in the invigilator app.
echo If you still get errors, try running this script as Administrator.
echo.
pause