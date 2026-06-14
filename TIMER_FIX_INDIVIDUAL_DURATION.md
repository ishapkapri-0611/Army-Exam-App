# Timer Fix - Individual Candidate Duration

## Build Date
**November 29, 2025 - 8:47 PM**

## Issue Fixed

### Problem
When candidates joined the exam at different times, late joiners were losing time:
- **Example**: 
  - Candidate A starts exam at 10:00 AM
  - Candidate B starts exam at 10:02 AM (2 minutes late)
  - Candidate B only gets 58 minutes instead of full 60 minutes
  - The 2 minutes were deducted from Candidate B's time

### Root Cause
The exam timer was using a **global exam start time** for all candidates. When calculating remaining time, it would:
1. Get the server's global exam start time
2. Calculate elapsed time from that global start time
3. Deduct elapsed time from total duration
4. This penalized late joiners

## Solution

### Individual Timer Per Candidate
Each candidate now gets their **full exam duration** from when they personally start the exam, regardless of when others started.

**Before:**
```javascript
// Used global exam start time
if (this.examStartTime) {
    const now = new Date();
    const elapsedSeconds = Math.floor((now - this.examStartTime) / 1000);
    remainingTime = Math.max(0, (examDuration * 60) - elapsedSeconds);
}
```

**After:**
```javascript
// Each candidate gets full duration
const remainingTime = examDuration * 60; // full duration in seconds

// Store individual candidate's start time
const candidateStartTime = new Date();
localStorage.setItem('candidateStartTime', candidateStartTime.toISOString());
```

## Changes Made

### File Modified
`candidateApp/src/renderer/exam-controller.js`

### 1. Start Exam Function (Lines 127-147)
**Changed:**
- Removed calculation based on global exam start time
- Each candidate now gets full duration
- Store individual candidate's start time in localStorage

**Code:**
```javascript
startExam() {
    const examDuration = this.examDuration || 60; // minutes
    
    // Each candidate gets full duration from when they personally start
    const remainingTime = examDuration * 60; // full duration in seconds
    
    // Store individual candidate's start time
    const candidateStartTime = new Date();
    localStorage.setItem('candidateStartTime', candidateStartTime.toISOString());
    
    console.log(`Candidate starting exam at: ${candidateStartTime}`);
    console.log(`Full duration: ${examDuration} minutes (${remainingTime} seconds)`);
    
    this.examTimer = new ExamTimer(
        remainingTime, // pass full duration in seconds
        (time) => this.updateTimerDisplay(time),
        () => this.autoSubmitExam(),
        true // indicate this is in seconds, not minutes
    );
    
    this.examTimer.start();
}
```

### 2. Submission Data (Lines 430-443)
**Added:**
- Track candidate's individual start time
- Calculate actual time taken by the candidate
- Include start time and time taken in submission data

**Code:**
```javascript
// Get candidate's individual start time
const candidateStartTime = localStorage.getItem('candidateStartTime');
const startTime = candidateStartTime ? new Date(candidateStartTime) : new Date();
const endTime = new Date();
const timeTaken = Math.floor((endTime - startTime) / 1000); // in seconds

const submissionData = {
    armyNumber: candidateInfo.armyNumber,
    candidateId: candidateInfo.armyNumber,
    candidate: candidateInfo,
    answers: formattedAnswers,
    submittedAt: endTime.toISOString(),
    startedAt: startTime.toISOString(),  // NEW
    timeTaken: `${Math.floor(timeTaken / 60)} minutes ${timeTaken % 60} seconds`,  // NEW
    securityReport: securityReport
};
```

### 3. Cleanup (Line 483)
**Added:**
- Remove candidate's individual start time on submission

**Code:**
```javascript
localStorage.removeItem('candidateStartTime');
```

## Updated Application

✅ **Army-Exam-Candidate-FAST** - Rebuilt at 8:47:12 PM

## How It Works Now

### Scenario: Multiple Candidates Join at Different Times

**Exam Duration: 60 minutes**

| Candidate | Join Time | Gets Duration | Timer Starts From | Timer Ends At |
|-----------|-----------|---------------|-------------------|---------------|
| Candidate A | 10:00 AM | 60 minutes | 10:00 AM | 11:00 AM |
| Candidate B | 10:02 AM | 60 minutes | 10:02 AM | 11:02 AM |
| Candidate C | 10:05 AM | 60 minutes | 10:05 AM | 11:05 AM |
| Candidate D | 10:10 AM | 60 minutes | 10:10 AM | 11:10 AM |

**Result:** ✅ Every candidate gets the full 60 minutes, regardless of when they join!

## Benefits

1. ✅ **Fair for all candidates** - Everyone gets equal time
2. ✅ **No time penalty** - Late joiners don't lose time
3. ✅ **Individual tracking** - Each candidate's actual time is recorded
4. ✅ **Flexible exam start** - Candidates can join at different times
5. ✅ **Accurate time tracking** - Submission includes actual time taken

## Testing

To verify the fix:

1. **Start the invigilator app** and begin an exam
2. **Candidate A logs in** at time T
   - Should see full 60 minutes on timer
3. **Wait 2 minutes**
4. **Candidate B logs in** at time T+2
   - Should also see full 60 minutes on timer (not 58 minutes)
5. **Verify both candidates** get their full duration

## Additional Data Tracked

The submission now includes:
- `startedAt`: When this specific candidate started the exam
- `timeTaken`: How long this candidate took to complete
- `submittedAt`: When this candidate submitted

This allows the invigilator to see:
- Who joined late
- How much time each candidate actually used
- Individual performance metrics

## Notes

- The global `examStartTime` is still stored (from server) but no longer used for timer calculation
- Each candidate's timer is independent
- The fix is backward compatible - existing functionality remains unchanged
- Security monitoring still tracks the full session from candidate's individual start time
