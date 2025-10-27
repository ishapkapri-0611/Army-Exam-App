# BUILDING THE ARMY EXAM APPLICATIONS - STEP BY STEP

## 🎯 WHAT IS THIS?

Your developer has given you the **source code** for the Army Exam System. Before you can use it, you need to **build** it into actual applications (.exe files) that you can run.

**Think of it like this**: You have the recipe (source code), now you need to cook it (build process) to get the meal (applications).

## ⚠️ IMPORTANT NOTES

- **This is a ONE-TIME process** - you only need to do this once
- **Requires internet connection** - to download build tools
- **Takes 5-10 minutes** - be patient, don't close the window
- **Need administrator rights** - right-click and "Run as administrator"

## 📋 STEP-BY-STEP INSTRUCTIONS

### STEP 1: PREPARE
1. **Copy the entire "Army Exam System" folder** to your computer
2. **Place it on Desktop** for easy access
3. **Ensure internet connection** is working
4. **Close antivirus temporarily** (if it blocks the process)

### STEP 2: BUILD THE APPLICATIONS
1. **Navigate to** the "Army Exam System" folder
2. **Find the file**: `BUILD_PORTABLE_ONLY.bat`
3. **Right-click** on `BUILD_PORTABLE_ONLY.bat`
4. **Select**: "Run as administrator"
5. **Click "Yes"** when Windows asks for permission

### STEP 3: WAIT FOR COMPLETION
You'll see a black command window with text scrolling. This is normal!

**What you'll see:**
```
========================================
   BUILDING PORTABLE ARMY EXAM APPS
========================================

Installing build dependencies...
Building Portable Invigilator Application...
Building Portable Candidate Application...
```

**DO NOT CLOSE THIS WINDOW!** Let it complete.

### STEP 4: VERIFY SUCCESS
When complete, you'll see:
```
========================================
        PORTABLE BUILD COMPLETE!
========================================

Portable applications are in:
- dist/invigilator/Army-Exam-Invigilator-Portable.exe
- dist/candidate/Army-Exam-Candidate-Portable.exe

These can be run directly without installation!

Press any key to continue...
```

### STEP 5: FIND YOUR APPLICATIONS
1. **Look in the "Army Exam System" folder**
2. **You'll now see a new "dist" folder**
3. **Inside dist, you'll find:**
   ```
   dist/
   ├── invigilator/
   │   └── Army-Exam-Invigilator-Portable.exe  ← For exam administrators
   └── candidate/
       └── Army-Exam-Candidate-Portable.exe    ← For candidates
   ```

## ✅ SUCCESS! YOU'RE READY

**Congratulations!** You now have working Army Exam applications.

**Next steps:**
1. **Test both applications** by double-clicking them
2. **Follow the CLIENT_SETUP_GUIDE.md** for conducting exams
3. **Keep the original folder** as backup

## 🔧 TROUBLESHOOTING BUILD ISSUES

### Problem: "Access denied" or "Permission denied"
**Solution**: 
- Right-click `BUILD_PORTABLE_ONLY.bat` → "Run as administrator"
- Make sure you're logged in as an administrator

### Problem: Build stops with errors
**Solutions**:
1. **Check internet connection** - build needs to download tools
2. **Disable antivirus temporarily** - it may block the process
3. **Free up disk space** - need at least 2GB free
4. **Close other programs** - free up memory

### Problem: "npm not found" or similar errors
**Solution**:
- The build process installs Node.js automatically
- If it fails, restart your computer and try again
- Ensure you have administrator rights

### Problem: Build completes but no .exe files
**Solutions**:
1. **Check the dist/ folder** - files should be there
2. **Look for error messages** in the build window
3. **Try running BUILD_APPLICATIONS.bat** instead (takes longer but more reliable)

### Problem: Antivirus deletes the .exe files
**Solutions**:
1. **Add the "Army Exam System" folder** to antivirus exceptions
2. **Temporarily disable real-time protection** during build
3. **Restore files from quarantine** if they were deleted

## 📞 GETTING HELP

### If Build Fails:
1. **Take a screenshot** of any error messages
2. **Note your Windows version** (Windows 10/11)
3. **Check if you have administrator rights**
4. **Try on a different computer** if available

### Information to Provide to Developer:
- **Exact error message** (screenshot preferred)
- **Windows version** and bit-type (32-bit/64-bit)
- **Available disk space**
- **Antivirus software** being used
- **When the error occurs** (beginning, middle, end of build)

## 🎖️ ARMY-SPECIFIC NOTES

### Security:
- **Build process is safe** - only creates applications from provided source
- **No external connections** made except to download standard build tools
- **All code is provided by your developer** - nothing malicious

### Offline Use:
- **After building once**, applications work completely offline
- **No internet required** for conducting exams
- **All data stays on your computers**

### Multiple Computers:
- **Build on one computer** then copy .exe files to others
- **No need to build on every computer**
- **Share the .exe files** via USB drive or network

---

## 🎯 SUMMARY

1. **Run BUILD_PORTABLE_ONLY.bat as administrator**
2. **Wait 5-10 minutes for completion**
3. **Find .exe files in dist/ folders**
4. **You're ready to conduct exams!**

**This is a one-time process** - once built, you can use the applications for all future exams without rebuilding.

---

*If you encounter any issues during the build process, don't hesitate to contact your developer with specific error messages and system details.*