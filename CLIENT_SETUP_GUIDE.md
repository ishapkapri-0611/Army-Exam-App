# ARMY EXAM SYSTEM - CLIENT SETUP GUIDE

## 📋 WHAT YOU WILL RECEIVE

Your developer will provide you with a folder containing:
```
Army Exam System/
├── BUILD_PORTABLE_ONLY.bat             ← Run this FIRST to create applications
├── BUILD_APPLICATIONS.bat              ← Alternative build option
├── invigilatorApp/                     ← Source files for admin app
├── candidateApp/                       ← Source files for candidate app
├── CLIENT_SETUP_GUIDE.md               ← This guide
├── questions-format-example.txt        ← How to format questions
└── sample-files/                       ← Example files (if provided)
    ├── sample-candidates.docx
    └── sample-questions.docx
```

## ⚠️ IMPORTANT: FIRST-TIME SETUP REQUIRED

**Before you can use the exam system, you MUST build the applications first!**

## 🖥️ SYSTEM REQUIREMENTS

### Minimum Requirements:
- **Operating System**: Windows 10 or Windows 11
- **RAM**: 4GB minimum
- **Storage**: 1GB free space per computer
- **Network**: Required only if using multiple computers

### Recommended Setup:
- **For Small Exams (1-10 candidates)**: 1 computer with both applications
- **For Large Exams (10+ candidates)**: 1 admin computer + 1 computer per candidate

## 🚀 SETUP PROCESS

### STEP 1: BUILD THE APPLICATIONS (FIRST TIME ONLY)

**This step creates the actual .exe files you'll use for exams.**

1. **Copy the entire "Army Exam System" folder** to your computer
2. **Place it on Desktop** for easy access
3. **Right-click** on `BUILD_PORTABLE_ONLY.bat`
4. **Select "Run as administrator"**
5. **Wait 5-10 minutes** for the build process to complete
6. **You'll see a message "PORTABLE BUILD COMPLETE!"**

**After building, you'll find these new files:**
```
Army Exam System/
├── dist/
│   ├── invigilator/
│   │   └── Army-Exam-Invigilator-Portable.exe  ← For exam administrators
│   └── candidate/
│       └── Army-Exam-Candidate-Portable.exe    ← For candidates
```

### STEP 2: PREPARE YOUR COMPUTERS

#### Single Computer Setup (Recommended for small exams):
1. **Copy both .exe files** from the `dist/` folders to your desktop
2. **That's it!** - Ready to use

#### Multiple Computer Setup (For large exams):
1. **Copy both .exe files** to the main admin computer
2. **Copy only "Army-Exam-Candidate-Portable.exe"** to each candidate computer
3. **Ensure all computers are connected** to the same network (WiFi or LAN)

### STEP 3: PREPARE YOUR EXAM FILES

#### Create Candidates List (DOCX file):
1. **Open Microsoft Word**
2. **Create a new document**
3. **Type candidate information** in this format:
```
JC543031A, John Doe, Captain, 1st Battalion
JC543032B, Jane Smith, Major, 2nd Battalion
HV123456A, Mike Johnson, Lieutenant, 3rd Battalion
```
4. **Save as**: `candidates.docx`

#### Create Questions File (DOCX file):
1. **Open Microsoft Word**
2. **Create a new document**
3. **Type questions** in this format:
```
Q1. What is the capital of India? [2 marks]
A. New Delhi
B. Mumbai
C. Kolkata
D. Chennai
Correct Answer: A

Q2. Which is the largest state by area? [3 marks]
A. Maharashtra
B. Rajasthan
C. Uttar Pradesh
D. Madhya Pradesh
Correct Answer: B
```
4. **Save as**: `questions.docx`

## 🎯 CONDUCTING AN EXAM

### PHASE 1: SETUP (Admin Computer)

1. **Double-click**: `Army-Exam-Invigilator-Portable.exe` (from `dist/invigilator/` folder)
   - Application will open (may take 30 seconds first time)
   - You'll see the exam management interface

2. **Upload Candidates List**:
   - Click "Upload Candidates" button
   - Select your `candidates.docx` file
   - Wait for "Upload successful" message

3. **Upload Questions**:
   - Click "Upload Questions" button
   - Select your `questions.docx` file
   - Wait for "Upload successful" message

4. **Start Exam Server**:
   - Click "Start Server" button
   - Server will start and be **automatically discoverable** by candidate computers
   - Keep this application running during the exam

### PHASE 2: CANDIDATE SETUP

#### For Single Computer (candidates use same computer):
1. **Double-click**: `Army-Exam-Candidate-Portable.exe` (from `dist/candidate/` folder)
2. **Candidates can now login** with their army numbers

#### For Multiple Computers:
1. **On each candidate computer**:
   - Double-click `Army-Exam-Candidate-Portable.exe`
   - **The app will automatically find the server** (no setup needed!)
   - If connection fails, it will show available servers to choose from

2. **Candidates can now login** with their army numbers

### PHASE 3: MONITORING EXAM

1. **On admin computer**, you can see:
   - **Live candidate connections**
   - **Exam progress** for each candidate
   - **Real-time answer submissions**
   - **Completion status**

2. **During exam**:
   - Keep admin application running
   - Monitor candidate progress
   - Watch for any technical issues

### PHASE 4: EXPORT RESULTS

1. **After all candidates finish**:
   - Click **"Calculate Results"** button
   - Click **"Export Results"** button
   - Choose location to save results
   - Results will be saved as Word document

## 📱 EXAM DAY WORKFLOW

### 30 Minutes Before Exam:
- [ ] Set up admin computer with invigilator app
- [ ] Upload candidates and questions
- [ ] Start exam server
- [ ] Test candidate computers
- [ ] Verify network connections

### During Exam:
- [ ] Keep admin application running
- [ ] Monitor candidate progress
- [ ] Help candidates with login issues
- [ ] Watch for technical problems

### After Exam:
- [ ] Wait for all candidates to finish
- [ ] Export results immediately
- [ ] Save backup copy of results
- [ ] Close applications

## 🔧 TROUBLESHOOTING

### Problem: Build process fails
**Solutions**:
1. **Ensure internet connection** - needed to download build tools
2. **Run as administrator** - right-click BUILD_PORTABLE_ONLY.bat → "Run as administrator"
3. **Check antivirus** - may block the build process
4. **Free up disk space** - need at least 2GB free space

### Problem: Application won't start (after building)
**Solutions**:
1. **Right-click** → **"Run as administrator"**
2. **Check antivirus** - add application to exceptions
3. **Ensure Windows 10/11** - older versions not supported
4. **Verify build completed** - check if .exe files exist in dist/ folders

### Problem: "Windows protected your PC" message
**Solution**:
1. **Click "More info"**
2. **Click "Run anyway"**
3. **Application is safe** - this is normal for new applications

### Problem: Candidates can't connect (multiple computers)
**Solutions**:
1. **Check IP address** in candidate app settings
2. **Verify network connection** - all computers on same WiFi/LAN
3. **Check Windows Firewall** - may need to allow application
4. **Test with ping**: Open Command Prompt, type `ping [IP-address]`

### Problem: File upload fails
**Solutions**:
1. **Check file format** - must be .docx (Word document)
2. **Verify file content** - follow exact format from examples
3. **Try smaller file** - reduce number of questions/candidates
4. **Close Word** - ensure file is not open in Microsoft Word

### Problem: Results export fails
**Solutions**:
1. **Ensure candidates finished** - check all have submitted
2. **Try different location** - save to Desktop instead
3. **Check disk space** - ensure enough free space
4. **Close other applications** - free up system resources

## 📞 GETTING HELP

### Before Calling Support:
1. **Note exact error message** (take screenshot if possible)
2. **Check Windows version** (Windows 10/11 required)
3. **Try restarting** the application
4. **Check network connectivity** (for multi-computer setup)

### Information to Provide:
- **Windows version** (e.g., Windows 10, Windows 11)
- **Number of computers** being used
- **Exact error message** or problem description
- **When the problem occurs** (startup, during exam, export, etc.)

## ✅ SUCCESS CHECKLIST

### Before First Use:
- [ ] Build process completed successfully
- [ ] .exe files created in dist/ folders
- [ ] Applications start without errors
- [ ] Can upload sample candidates file
- [ ] Can upload sample questions file
- [ ] Can start exam server
- [ ] Can connect candidate app (if using multiple computers)
- [ ] Can export test results

### Exam Day Ready:
- [ ] Real candidates file prepared and tested
- [ ] Real questions file prepared and tested
- [ ] All computers tested and working
- [ ] Network connectivity verified (if applicable)
- [ ] Backup plan prepared (extra computer, printed questions)

## 🎖️ ARMY-SPECIFIC NOTES

### Security:
- **Applications run offline** - no internet required during exam
- **Data stays local** - no information sent outside your network
- **Results saved locally** - full control over exam data

### Compliance:
- **Professional format** - suitable for official army exams
- **Audit trail** - all actions logged with timestamps
- **Secure results** - Word document format for official records

### Scalability:
- **Small units**: 1 computer, 1-10 candidates
- **Medium units**: 1 admin + 5-10 candidate computers
- **Large units**: 1 admin + 20+ candidate computers

---

## 🎯 QUICK START SUMMARY

1. **Copy files** to your computer(s)
2. **Run BUILD_PORTABLE_ONLY.bat** (first time only, takes 5-10 minutes)
3. **Prepare** candidates.docx and questions.docx files
4. **Run** Army-Exam-Invigilator-Portable.exe (from dist/invigilator/ folder)
5. **Upload** your files
6. **Start** exam server
7. **Run** Army-Exam-Candidate-Portable.exe (from dist/candidate/ folder) for candidates
8. **Monitor** exam progress
9. **Export** results when complete

**First-time setup**: 15-20 minutes (includes build process)
**Subsequent exams**: 5 minutes setup
**Technical expertise required**: Minimal
**Support needed**: Basic computer skills

---

*This system has been designed specifically for army use with minimal technical requirements and maximum reliability.*