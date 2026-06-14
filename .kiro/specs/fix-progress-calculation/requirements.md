# Requirements Document

## Introduction

This document specifies the requirements for fixing the incorrect progress calculation displayed in the invigilator dashboard. The issue manifests as "100% (12/5)" where 12 represents questions answered and 5 represents total questions, but the actual exam has more than 5 questions. This indicates a mismatch between the client-side answer tracking and the server-side question count being reported to the invigilator dashboard.

## Glossary

- **Invigilator Dashboard**: The monitoring interface used by exam administrators to track candidate progress in real-time
- **Progress Display**: The UI component showing "X% (answered/total)" format indicating exam completion status
- **Candidate App**: The application used by exam candidates to answer questions
- **Server**: The backend system that manages exam data, questions, and submissions
- **Analytics Engine**: The component responsible for calculating and tracking candidate statistics
- **Monitoring Manager**: The component that aggregates candidate data for the invigilator dashboard

## Requirements

### Requirement 1

**User Story:** As an invigilator, I want to see accurate progress information for each candidate, so that I can properly monitor exam completion status.

#### Acceptance Criteria

1. WHEN a candidate answers questions, THE Invigilator Dashboard SHALL display the correct count of answered questions
2. WHEN a candidate answers questions, THE Invigilator Dashboard SHALL display the correct total number of questions in the exam
3. WHEN calculating progress percentage, THE Server SHALL use the actual total question count from the loaded exam data
4. THE Progress Display SHALL show the format "X% (answered/total)" where answered ≤ total at all times
5. WHEN the exam has 12 questions and a candidate answers all 12, THE Progress Display SHALL show "100% (12/12)" not "100% (12/5)"

### Requirement 2

**User Story:** As a developer, I want the analytics engine to use consistent question counts, so that progress calculations are accurate across all components.

#### Acceptance Criteria

1. WHEN the Analytics Engine initializes an exam, THE Analytics Engine SHALL store the correct total question count from the exam configuration
2. WHEN recording candidate answers, THE Analytics Engine SHALL calculate progress using the stored total question count
3. WHEN the exam configuration contains N questions, THE Analytics Engine SHALL use N as the denominator for all progress calculations
4. THE Analytics Engine SHALL NOT use hardcoded or default question counts for progress calculations

### Requirement 3

**User Story:** As an invigilator, I want the connected candidates table to update in real-time with accurate progress, so that I can monitor exam status without refreshing.

#### Acceptance Criteria

1. WHEN a candidate submits an answer, THE Monitoring Manager SHALL receive the updated progress with correct question counts
2. WHEN broadcasting candidate status, THE Server SHALL include both answered count and total question count
3. THE Invigilator Dashboard SHALL display progress updates within 2 seconds of answer submission
4. WHEN multiple candidates are taking the exam, THE Progress Display SHALL show accurate individual progress for each candidate
