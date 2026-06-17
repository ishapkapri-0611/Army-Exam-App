const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

class ExamServer {
    constructor(port = 9611) {
        this.port = port;
        this.isRunning = false;
        this.startTime = null;
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        this.connectedCandidates = new Map();
        this.examData = {
            users: [],
            questions: [],
            answers: new Map(),
            startTime: null,
            duration: 60
        };
        this.answersFilePath = path.join(__dirname, '../../results/all_answers.json');
        this.dataDir = path.join(__dirname, 'data');

        // Defer heavy initialization until server actually starts
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
    }

    loadDataFromDisk() {
        console.log('📂 Loading data from disk...');
        const errors = [];

        // Load users
        const usersFilePath = path.join(this.dataDir, 'users.json');
        if (fs.existsSync(usersFilePath)) {
            try {
                const usersData = fs.readFileSync(usersFilePath, 'utf8');
                const parsed = JSON.parse(usersData);
                if (!Array.isArray(parsed)) {
                    throw new Error('users.json does not contain an array');
                }
                this.examData.users = parsed;
                console.log(`✅ Loaded ${this.examData.users.length} users from disk`);
            } catch (error) {
                console.error('❌ Error loading users from disk:', error);
                errors.push(`Users: ${error.message}`);
                this.examData.users = [];
            }
        } else {
            console.log('📄 No users file found on disk');
        }

        // Load questions
        const questionsFilePath = path.join(this.dataDir, 'questions.json');
        console.log(`🔍 Looking for questions file at: ${questionsFilePath}`);
        if (fs.existsSync(questionsFilePath)) {
            try {
                const questionsData = fs.readFileSync(questionsFilePath, 'utf8');
                const parsed = JSON.parse(questionsData);
                if (!Array.isArray(parsed)) {
                    throw new Error('questions.json does not contain an array');
                }
                this.examData.questions = parsed;
                const totalMarks = this.examData.questions.reduce((sum, q) => sum + (q.marks || 0), 0);
                console.log(`✅ Loaded ${this.examData.questions.length} questions from disk (${totalMarks} total marks)`);

                // Debug: Show loaded questions
                console.log('📋 Loaded questions details:');
                this.examData.questions.forEach(q => {
                    console.log(`  Q${q.id}: "${q.text.substring(0, 30)}..." → Correct: ${q.correctAnswer}`);
                });
            } catch (error) {
                console.error('❌ Error loading questions from disk:', error);
                errors.push(`Questions: ${error.message}`);
                this.examData.questions = [];
            }
        } else {
            console.log('📄 No questions file found on disk');
        }

        if (errors.length > 0) {
            console.error('⚠️ Data loading completed with errors:', errors.join('; '));
        }

        // Clear any existing answers for fresh start
        this.examData.answers.clear();
        console.log('🧹 Cleared previous answers - starting fresh each session');

        // Clear the answers file to start fresh
        try {
            fs.writeFileSync(this.answersFilePath, '[]');
            console.log('🗑️ Cleared answers file for fresh start');
        } catch (error) {
            console.error('❌ Error clearing answers file:', error);
        }

        // Note: We don't load previous answers from disk to ensure fresh start each time
        // Answers will be collected during the current session only
    }

    setupMiddleware() {
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(express.static(path.join(__dirname, '../../public')));
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/api/health', (req, res) => {
            res.json({
                status: 'ok',
                server: 'running',
                uptime: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
                connectedCandidates: this.connectedCandidates.size
            });
        });

        // API endpoint to get all submissions for the table
        this.app.get('/api/submissions', (req, res) => {
            try {
                const submissions = this.getSubmissions();
                // Get actual total questions from submissions if available
                const actualTotalQuestions = submissions.length > 0 ? submissions[0].totalQuestions : this.examData.questions.length;
                res.json({
                    success: true,
                    submissions: submissions,
                    summary: {
                        totalSubmissions: submissions.length,
                        totalQuestions: actualTotalQuestions,
                        totalCandidates: this.examData.users.length
                    }
                });
            } catch (error) {
                console.error('Error retrieving submissions:', error);
                res.status(500).json({ success: false, error: 'Internal server error' });
            }
        });

        // Authentication endpoint
        this.app.post('/api/login', (req, res) => {
            try {
                const { armyNumber, password } = req.body;
                console.log('Login attempt:', { armyNumber });
                if (armyNumber === 'admin' && password === 'admin@0611') {
                    return res.json({
                        success: true,
                        role: 'invigilator',
                        message: 'Invigilator login successful'
                    });
                }
                // Support both old format (JC543031A) and new format (145699Z)
                const oldPattern = /^[A-Z]{2}\d{6}[A-Z]?$/;
                const newPattern = /^\d+[A-Z]$/;
                const isValidFormat = oldPattern.test(armyNumber) || newPattern.test(armyNumber);
                
                if (!isValidFormat) {
                    return res.json({
                        success: false,
                        error: 'Invalid Army Number format (expected format: JC543031A or 145699Z)'
                    });
                }
                console.log('Current users in examData:', this.examData.users);
                const candidate = this.examData.users.find(user => user.armyNumber === armyNumber);
                if (candidate) {
                    return res.json({
                        success: true,
                        role: 'candidate',
                        candidate: {
                            armyNumber: candidate.armyNumber,
                            name: candidate.name,
                            rank: candidate.rank,
                            unit: candidate.unit
                        },
                        examData: {
                            questions: this.examData.questions,
                            duration: this.examData.duration,
                            startTime: this.examData.startTime,
                            serverTime: new Date(),
                            isExamActive: !!this.examData.startTime
                        }
                    });
                }
                res.json({
                    success: false,
                    error: 'Invalid Army Number or password'
                });
            } catch (error) {
                console.error('Login error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Internal server error'
                });
            }
        });

        // Get server status
        this.app.get('/api/status', (req, res) => {
            res.json({
                isRunning: this.isRunning,
                port: this.port,
                connectedCandidates: this.connectedCandidates.size,
                uptime: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
                examStarted: !!this.examData.startTime,
                totalQuestions: this.examData.questions.length,
                totalUsers: this.examData.users.length
            });
        });

        // Upload endpoints
        this.app.post('/api/upload/users', (req, res) => {
            try {
                const { users } = req.body;
                if (users && Array.isArray(users)) {
                    this.examData.users = users;
                    console.log(`Uploaded ${users.length} users`);
                    console.log('First user sample:', users[0]);

                    // Save to disk for persistence
                    const usersFilePath = path.join(this.dataDir, 'users.json');
                    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
                    console.log(`✅ Users saved to disk: ${usersFilePath}`);

                    res.json({ success: true, count: users.length });
                } else {
                    res.status(400).json({ success: false, error: 'Invalid users data' });
                }
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/upload/questions', (req, res) => {
            try {
                const { questions } = req.body;
                if (questions && Array.isArray(questions)) {
                    this.examData.questions = questions;
                    console.log(`Uploaded ${questions.length} questions`);
                    
                    // Debug: Log each question's marks
                    console.log('📋 Question marks breakdown:');
                    questions.forEach(q => {
                        console.log(`  Q${q.id}: marks = ${q.marks || 0}`);
                    });

                    // Save to disk for persistence
                    const questionsFilePath = path.join(this.dataDir, 'questions.json');
                    fs.writeFileSync(questionsFilePath, JSON.stringify(questions, null, 2));
                    console.log(`✅ Questions saved to disk: ${questionsFilePath}`);

                    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
                    console.log(`📊 Total marks: ${totalMarks}`);
                    res.json({ success: true, count: questions.length, totalMarks: totalMarks });
                } else {
                    res.status(400).json({ success: false, error: 'Invalid questions data' });
                }
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Enhanced /api/submit-exam with flexible data handling
        this.app.post('/api/submit-exam', (req, res) => {
            console.log('--- /api/submit-exam called ---');
            console.log('Questions loaded in examData:', this.examData.questions ? this.examData.questions.length : 0);
            console.log('Received body:', JSON.stringify(req.body, null, 2));
            
            try {
                const examData = req.body.examData || req.body;

                // Accept multiple formats for army number
                const armyNumber = examData.armyNumber ||
                    (examData.candidate && examData.candidate.armyNumber) ||
                    examData.candidateId;

                if (!armyNumber) {
                    console.log('Missing army number in submission:', JSON.stringify(examData, null, 2));
                    return res.status(400).json({
                        success: false,
                        error: 'Army number is required for submission'
                    });
                }

                if (!examData.answers) {
                    console.log('Missing answers in submission:', JSON.stringify(examData, null, 2));
                    return res.status(400).json({
                        success: false,
                        error: 'Answers are required for submission'
                    });
                }

                // Handle different answer formats
                let answersToProcess = [];

                if (Array.isArray(examData.answers)) {
                    // Check if it's array of arrays [[questionId, answer]] or array of objects
                    if (examData.answers.length > 0) {
                        if (Array.isArray(examData.answers[0])) {
                            // Format: [[questionId, answer], ...]
                            answersToProcess = examData.answers;
                        } else if (typeof examData.answers[0] === 'object') {
                            // Format: [{questionId: 1, answer: 'A'}, ...]
                            answersToProcess = examData.answers.map(ans => [
                                ans.questionId || ans.id,
                                ans.answer || ans.selectedAnswer
                            ]);
                        }
                    }
                } else if (typeof examData.answers === 'object') {
                    // Format: {1: 'A', 2: 'B', ...}
                    answersToProcess = Object.entries(examData.answers);
                }

                if (answersToProcess.length === 0) {
                    console.log('No valid answers found in submission');
                    return res.status(400).json({
                        success: false,
                        error: 'No valid answers found in submission'
                    });
                }

                // Store answers in the in-memory map
                answersToProcess.forEach(([questionId, selectedAnswer]) => {
                    const answerKey = `${armyNumber}-${questionId}`;
                    this.examData.answers.set(answerKey, {
                        candidateId: armyNumber,
                        questionId: questionId,
                        selectedAnswer: selectedAnswer,
                        timestamp: examData.submittedAt || new Date(),
                        ip: req.ip
                    });
                });

                // Save all answers to file
                try {
                    const answersArray = Array.from(this.examData.answers.values());
                    fs.writeFileSync(this.answersFilePath, JSON.stringify(answersArray, null, 2));
                    console.log(`💾 Saved ${answersArray.length} total answers to file`);
                } catch (fileError) {
                    console.error('⚠️ Failed to save answers to file:', fileError.message);
                    // Continue anyway - answers are in memory
                }

                console.log(`✅ Stored ${answersToProcess.length} answers for ${armyNumber}`);

                // Calculate individual result immediately after submission
                let individualResult = null;
                try {
                    // Check if questions are available before calculating
                    if (!this.examData.questions || this.examData.questions.length === 0) {
                        console.warn('⚠️ No questions loaded - cannot calculate result yet');
                        individualResult = {
                            message: 'Answers submitted successfully. Results will be calculated by invigilator.',
                            status: 'SUBMITTED',
                            answersCount: answersToProcess.length
                        };
                    } else {
                        const candidateSubmission = {
                            candidateId: armyNumber,
                            submittedAt: examData.submittedAt || new Date(),
                            timeTaken: examData.timeTaken || 'N/A'
                        };

                        individualResult = this.calculateIndividualResult(candidateSubmission);
                        console.log('✅ Result calculated successfully');
                    }
                } catch (resultError) {
                    console.error('⚠️ Failed to calculate result, but answers are saved:', resultError.message);
                    console.error('Result error stack:', resultError.stack);
                    // Don't fail the submission if result calculation fails
                    individualResult = {
                        message: 'Answers submitted successfully. Results will be calculated by invigilator.',
                        status: 'SUBMITTED',
                        answersCount: answersToProcess.length
                    };
                }

                res.json({
                    success: true,
                    message: 'Exam submitted successfully',
                    answersCount: answersToProcess.length,
                    candidateId: armyNumber,
                    result: individualResult
                });
            } catch (error) {
                console.error('❌ Exam submission error:', error);
                console.error('Error stack:', error.stack);
                console.error('Request body:', JSON.stringify(req.body, null, 2));
                res.status(500).json({ 
                    success: false, 
                    error: 'Internal server error: ' + error.message 
                });
            }
        });

        // Add endpoint to get all submitted answers
        this.app.get('/api/answers', (req, res) => {
            try {
                const answersArray = Array.from(this.examData.answers.values());
                res.json({ success: true, answers: answersArray });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Get individual candidate result by army number
        this.app.get('/api/candidate-result/:armyNumber', (req, res) => {
            try {
                const { armyNumber } = req.params;
                console.log(`📊 Getting result for candidate: ${armyNumber}`);

                // Find candidate's submissions (there will be multiple entries, one per question)
                const candidateAnswers = Array.from(this.examData.answers.values())
                    .filter(answer => answer.candidateId === armyNumber);

                if (candidateAnswers.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'No submission found for this army number'
                    });
                }

                // Create a submission object for the calculation
                const candidateSubmission = {
                    candidateId: armyNumber,
                    submittedAt: candidateAnswers[0].timestamp,
                    timeTaken: 'N/A' // We can calculate this later if needed
                };

                // Calculate individual result
                const result = this.calculateIndividualResult(candidateSubmission);

                console.log(`✅ Result calculated for ${armyNumber}:`, result);

                res.json({
                    success: true,
                    result: result
                });

            } catch (error) {
                console.error('❌ Error getting candidate result:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Debug endpoint to check questions in memory
        this.app.get('/api/debug/questions', (req, res) => {
            try {
                res.json({
                    success: true,
                    questions: this.examData.questions,
                    count: this.examData.questions.length
                });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Debug endpoint to check answers in memory
        this.app.get('/api/debug/answers', (req, res) => {
            try {
                const answersArray = Array.from(this.examData.answers.entries());
                res.json({
                    success: true,
                    answers: answersArray,
                    answersCount: answersArray.length,
                    keys: Array.from(this.examData.answers.keys())
                });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Debug endpoint to see raw answer data
        this.app.get('/api/debug/raw-answers/:armyNumber', (req, res) => {
            try {
                const { armyNumber } = req.params;
                const candidateAnswers = Array.from(this.examData.answers.values())
                    .filter(answer => answer.candidateId === armyNumber);
                
                const questionsData = this.examData.questions.map(q => ({
                    id: q.id,
                    correctAnswer: q.correctAnswer,
                    marks: q.marks,
                    text: q.text ? q.text.substring(0, 50) + '...' : 'N/A'
                }));
                
                res.json({
                    success: true,
                    candidateAnswers: candidateAnswers,
                    questions: questionsData,
                    answersCount: candidateAnswers.length,
                    questionsCount: this.examData.questions.length
                });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Debug endpoint to check calculation details
        this.app.get('/api/debug/calculation', (req, res) => {
            try {
                const submissions = new Map();

                // Process all answers
                for (const [key, value] of this.examData.answers.entries()) {
                    const { candidateId, questionId, selectedAnswer } = value;

                    if (!submissions.has(candidateId)) {
                        const candidate = this.examData.users.find(user => user.armyNumber === candidateId);
                        submissions.set(candidateId, {
                            candidateId: candidateId,
                            name: candidate ? candidate.name : 'Unknown',
                            answers: [],
                            calculationSteps: []
                        });
                    }

                    submissions.get(candidateId).answers.push({
                        questionId: questionId,
                        selectedAnswer: selectedAnswer
                    });
                }

                // Calculate with detailed steps
                const submissionsArray = Array.from(submissions.values());
                submissionsArray.forEach(submission => {
                    let correctAnswers = 0;

                    submission.answers.forEach(answer => {
                        // Always map 0-based answer IDs to 1-based server question IDs
                        const mappedQuestionId = answer.questionId + 1;
                        const question = this.examData.questions.find(q => q.id === mappedQuestionId);

                        const isCorrect = question && question.correctAnswer === answer.selectedAnswer;

                        submission.calculationSteps.push({
                            originalQuestionId: answer.questionId,
                            mappedQuestionId: mappedQuestionId,
                            selectedAnswer: answer.selectedAnswer,
                            correctAnswer: question ? question.correctAnswer : 'NOT FOUND',
                            questionFound: !!question,
                            isCorrect: isCorrect
                        });

                        if (isCorrect) {
                            correctAnswers++;
                        }
                    });

                    submission.score = correctAnswers;
                    submission.totalQuestions = this.examData.questions.length;
                });

                res.json({
                    success: true,
                    submissions: submissionsArray,
                    serverQuestions: this.examData.questions.map(q => ({ id: q.id, correctAnswer: q.correctAnswer }))
                });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Export results to CSV
        this.app.get('/api/export-results', (req, res) => {
            try {
                const submissions = this.getSubmissions();
                const csv = this.generateCSV(submissions);

                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename=exam-results.csv');
                res.send(csv);
            } catch (error) {
                console.error('Export error:', error);
                res.status(500).json({ success: false, error: 'Export failed' });
            }
        });
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('🔌 Client connected:', socket.id);

            // Invigilator joins
            socket.on('invigilator-join', (data) => {
                socket.join('invigilators');
                console.log('👨‍💼 Invigilator connected:', socket.id);

                // Send current exam status
                socket.emit('exam-status', {
                    isRunning: this.isRunning,
                    connectedCandidates: this.connectedCandidates.size,
                    examStarted: !!this.examData.startTime,
                    usersCount: this.examData.users.length,
                    questionsCount: this.examData.questions.length
                });
            });

            // Candidate joins exam
            socket.on('candidate-join', (data) => {
                const { candidateId, candidateData } = data;

                this.connectedCandidates.set(socket.id, {
                    candidateId: candidateId,
                    candidateData: candidateData,
                    socketId: socket.id,
                    joinTime: new Date(),
                    lastActivity: new Date(),
                    ip: socket.handshake.address
                });

                socket.join('candidates');
                socket.join(`candidate-${candidateId}`);

                console.log(`👤 Candidate joined: ${candidateId} - ${candidateData.name}`);

                // Notify invigilators
                socket.to('invigilators').emit('candidate-joined', {
                    candidateId: candidateId,
                    candidateData: candidateData,
                    totalConnected: this.connectedCandidates.size,
                    timestamp: new Date()
                });

                // Send exam data to candidate if exam has started
                if (this.examData.startTime) {
                    socket.emit('exam-data', {
                        questions: this.examData.questions,
                        duration: this.examData.duration,
                        startTime: this.examData.startTime,
                        serverTime: new Date()
                    });

                    // Also send exam-start event for consistency
                    socket.emit('exam-start', {
                        questions: this.examData.questions,
                        duration: this.examData.duration,
                        startTime: this.examData.startTime,
                        serverTime: new Date()
                    });
                }
            });

            // Candidate submits answer
            socket.on('answer-submit', (data) => {
                const { candidateId, questionId, answer, timestamp } = data;
                const candidate = this.connectedCandidates.get(socket.id);

                if (candidate) {
                    // Store answer
                    const answerKey = `${candidateId}-${questionId}`;
                    this.examData.answers.set(answerKey, {
                        candidateId: candidateId,
                        questionId: questionId,
                        selectedAnswer: answer,
                        timestamp: timestamp || new Date(),
                        ip: socket.handshake.address
                    });

                    console.log(`📝 Answer submitted: ${candidateId} - Q${questionId} - ${answer}`);

                    // Notify invigilators
                    socket.to('invigilators').emit('answer-update', {
                        candidateId: candidateId,
                        questionId: questionId,
                        answer: answer,
                        progress: this.calculateProgress(candidateId),
                        timestamp: new Date()
                    });
                }
            });

            // Candidate activity ping
            socket.on('activity-ping', (data) => {
                const candidate = this.connectedCandidates.get(socket.id);
                if (candidate) {
                    candidate.lastActivity = new Date();
                }
            });

            // Security event from candidate
            socket.on('security-event', (data) => {
                console.log('🚨 Security event:', data);
                socket.to('invigilators').emit('security-alert', data);
            });

            // Disconnection handling
            socket.on('disconnect', (reason) => {
                console.log('🔌 Client disconnected:', socket.id, reason);

                const candidate = this.connectedCandidates.get(socket.id);
                if (candidate) {
                    this.connectedCandidates.delete(socket.id);

                    // Notify invigilators
                    socket.to('invigilators').emit('candidate-left', {
                        candidateId: candidate.candidateId,
                        candidateData: candidate.candidateData,
                        totalConnected: this.connectedCandidates.size,
                        timestamp: new Date()
                    });
                }
            });
        });
    }

    calculateProgress(candidateId) {
        const candidateAnswers = Array.from(this.examData.answers.values())
            .filter(answer => answer.candidateId === candidateId);

        const totalQuestions = this.examData.questions.length;
        return totalQuestions > 0 ? (candidateAnswers.length / totalQuestions) * 100 : 0;
    }

    getSubmissions() {
        console.log('Retrieving all submissions with candidate data');

        try {
            const submissions = new Map();
            
            // Track the maximum question ID seen across all answers to determine actual total questions
            let maxQuestionId = -1;

            // Safety check
            if (!this.examData || !this.examData.answers) {
                console.warn('⚠️ No answers data available');
                return [];
            }

            // Process all answers
            for (const [key, value] of this.examData.answers.entries()) {
                try {
                    const { candidateId, questionId, selectedAnswer, timestamp } = value;
                    
                    // Track max question ID
                    if (questionId > maxQuestionId) {
                        maxQuestionId = questionId;
                    }

                    if (!submissions.has(candidateId)) {
                        // Find candidate details from uploaded users
                        const candidate = this.examData.users ? 
                            this.examData.users.find(user => user.armyNumber === candidateId) : 
                            null;

                        submissions.set(candidateId, {
                            candidateId: candidateId,
                            name: candidate ? candidate.name : 'Unknown',
                            rank: candidate ? candidate.rank : 'N/A',
                            unit: candidate ? candidate.unit : 'N/A',
                            armyNumber: candidateId,
                            answers: [],
                    score: 0,
                    totalQuestions: 0, // Will be set after processing all answers
                    submittedAt: timestamp
                });
            }

                    submissions.get(candidateId).answers.push({
                        questionId: questionId,
                        selectedAnswer: selectedAnswer,
                        timestamp: timestamp
                    });
                } catch (answerError) {
                    console.error('Error processing answer:', answerError);
                }
            }
            
            // Determine actual total questions: use the larger of loaded questions or max question ID + 1
            const loadedQuestionsCount = this.examData.questions ? this.examData.questions.length : 0;
            const actualTotalQuestions = Math.max(loadedQuestionsCount, maxQuestionId + 1);
            
            console.log(`📊 Total questions determination:`);
            console.log(`   - Loaded questions: ${loadedQuestionsCount}`);
            console.log(`   - Max question ID seen: ${maxQuestionId}`);
            console.log(`   - Using total questions: ${actualTotalQuestions}`);

            // Calculate scores for each submission
            const submissionsArray = Array.from(submissions.values());

            submissionsArray.forEach(submission => {
                try {
                    let totalMarksObtained = 0;
                    let totalMarksAvailable = 0;
                    
                    // Safety check for questions
                    if (this.examData.questions && Array.isArray(this.examData.questions)) {
                        try {
                            totalMarksAvailable = this.examData.questions.reduce((sum, q) => sum + (q.marks || 0), 0);
                        } catch (reduceError) {
                            console.error('Error calculating total marks:', reduceError);
                            totalMarksAvailable = 0;
                        }
                    }
                    
                    // Set the actual total questions for this submission
                    submission.totalQuestions = actualTotalQuestions;

                    console.log(`🔍 Calculating score for ${submission.candidateId}:`);
                    console.log(`📋 Available questions in memory: ${loadedQuestionsCount}`);
                    console.log(`📊 Total marks available: ${totalMarksAvailable}`);
                    
                    if (this.examData.questions && Array.isArray(this.examData.questions)) {
                        this.examData.questions.forEach(q => {
                            console.log(`  Q${q.id}: Correct answer = ${q.correctAnswer}, Marks = ${q.marks || 0}`);
                        });

                        submission.answers.forEach(answer => {
                            try {
                                // Always map 0-based answer IDs to 1-based server question IDs
                                // Since server questions are always 1,2,3,4,5 and answers are 0,1,2,3,4
                                const mappedQuestionId = answer.questionId + 1;
                                const question = this.examData.questions.find(q => q.id === mappedQuestionId);

                                const isCorrect = question && question.correctAnswer === answer.selectedAnswer;
                                const marksForThisQuestion = question ? (question.marks || 0) : 0;

                                console.log(`  📝 Q${answer.questionId}→Q${mappedQuestionId}: Selected=${answer.selectedAnswer}, Correct=${question ? question.correctAnswer : 'NOT FOUND'}, Match=${isCorrect ? '✅' : '❌'}, Marks=${marksForThisQuestion}`);

                                if (isCorrect) {
                                    totalMarksObtained += marksForThisQuestion;
                                }
                            } catch (answerCalcError) {
                                console.error(`Error calculating answer for Q${answer.questionId}:`, answerCalcError);
                            }
                        });
                    } else {
                        console.warn('⚠️ No questions available for scoring');
                    }

                    console.log(`✅ Final score for ${submission.candidateId}: ${totalMarksObtained}/${totalMarksAvailable} marks`);

                    submission.score = totalMarksObtained;
                    submission.totalMarks = totalMarksAvailable;
                    submission.percentage = totalMarksAvailable > 0
                        ? ((totalMarksObtained / totalMarksAvailable) * 100).toFixed(2)
                        : 0;
                } catch (submissionError) {
                    console.error(`Error calculating submission for ${submission.candidateId}:`, submissionError);
                    submission.score = 0;
                    submission.totalMarks = 0;
                    submission.percentage = 0;
                }
            });

            console.log(`Found ${submissionsArray.length} submissions with scores`);
            return submissionsArray;
        } catch (error) {
            console.error('❌ Critical error in getSubmissions:', error);
            console.error('Error stack:', error.stack);
            throw new Error(`Failed to retrieve submissions: ${error.message}`);
        }
    }

    generateCSV(submissions) {
        const headers = ['Army Number', 'Name', 'Rank', 'Unit', 'Marks Obtained', 'Total Marks', 'Total Questions', 'Percentage', 'Submission Time'];
        let csv = headers.join(',') + '\n';

        submissions.forEach(submission => {
            const row = [
                `"${submission.armyNumber}"`,
                `"${submission.name}"`,
                `"${submission.rank}"`,
                `"${submission.unit}"`,
                submission.score,
                submission.totalMarks || submission.totalQuestions,
                submission.totalQuestions,
                submission.percentage,
                `"${new Date(submission.submittedAt).toLocaleString()}"`
            ];
            csv += row.join(',') + '\n';
        });

        return csv;
    }

    startExam(questions, duration = 60) {
        console.log(`📋 startExam called with ${questions ? questions.length : 0} questions`);
        
        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            const error = new Error('Cannot start exam: no valid questions provided');
            console.error('❌', error.message, '- received:', questions);
            throw error;
        }

        this.examData.questions = questions;
        console.log(`📝 Loaded ${questions.length} questions into examData`);
        console.log('First question:', questions[0]);
        
        // Save questions to disk for persistence
        try {
            const questionsFilePath = path.join(this.dataDir, 'questions.json');
            fs.writeFileSync(questionsFilePath, JSON.stringify(questions, null, 2));
            console.log(`💾 Questions saved to disk: ${questionsFilePath}`);
        } catch (err) {
            console.error('❌ Failed to save questions to disk:', err);
        }
        
        this.examData.startTime = new Date();
        this.examData.duration = duration;

        console.log(`🚀 Exam started! Duration: ${duration} minutes, Questions in memory: ${this.examData.questions.length}`);

        const examPayload = {
            questions: this.examData.questions,
            startTime: this.examData.startTime,
            duration: duration
        };

        // Notify all connected candidates
        this.io.to('candidates').emit('exam-start', examPayload);

        // Notify invigilators that exam has started
        this.io.to('invigilators').emit('exam-started', {
            startTime: this.examData.startTime,
            duration: duration,
            totalQuestions: this.examData.questions.length
        });
    }

    stopExam() {
        this.examData.startTime = null;
        console.log('⏹️ Exam stopped');

        // Notify all connected clients
        this.io.to('candidates').emit('exam-stopped', {
            stopTime: new Date()
        });
        this.io.to('invigilators').emit('exam-stopped', {
            stopTime: new Date()
        });
    }

    async start() {
        return new Promise((resolve, reject) => {
            if (this.isRunning) {
                reject(new Error('Server is already running'));
                return;
            }

            // Initialize data directory and load data only when server starts
            if (!fs.existsSync(this.dataDir)) {
                fs.mkdirSync(this.dataDir, { recursive: true });
            }
            this.loadDataFromDisk();

            this.server.listen(this.port, (err) => {
                if (err) {
                    console.error('❌ Failed to start server:', err);
                    reject(err);
                } else {
                    this.isRunning = true;
                    this.startTime = new Date();
                    console.log(`✅ Exam server started successfully on port ${this.port}`);
                    console.log(`🌐 Server URL: http://localhost:${this.port}`);
                    console.log(`🔧 Health check: http://localhost:${this.port}/api/health`);
                    resolve();
                }
            });

            // Handle server errors
            this.server.on('error', (err) => {
                console.error('❌ Server error:', err);
                if (err.code === 'EADDRINUSE') {
                    reject(new Error(`Port ${this.port} is already in use. Please use a different port.`));
                } else {
                    reject(err);
                }
            });
        });
    }

    async stop() {
        return new Promise((resolve, reject) => {
            if (!this.isRunning) {
                resolve();
                return;
            }

            this.server.close((err) => {
                if (err) {
                    console.error('Error stopping server:', err);
                    reject(new Error(`Failed to stop server: ${err.message}`));
                } else {
                    this.isRunning = false;
                    this.startTime = null;
                    this.connectedCandidates.clear();
                    console.log('✅ Exam server stopped successfully');
                    resolve();
                }
            });
        });
    }

    getConnectedCount() {
        return this.connectedCandidates.size;
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            port: this.port,
            connectedCandidates: this.connectedCandidates.size,
            uptime: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
            examStarted: !!this.examData.startTime
        };
    }

    calculateIndividualResult(candidateSubmission) {
        console.log(`🧮 Calculating individual result for: ${candidateSubmission.candidateId}`);

        try {
            // Safety check: ensure questions are loaded
            if (!this.examData || !this.examData.questions || this.examData.questions.length === 0) {
                console.error('❌ No questions loaded in examData');
                return {
                    armyNumber: candidateSubmission.candidateId,
                    name: 'Candidate',
                    rank: 'N/A',
                    unit: 'N/A',
                    score: 0,
                    totalMarks: 0,
                    totalQuestions: 0,
                    percentage: 0,
                    status: 'SUBMITTED',
                    submittedAt: candidateSubmission.submittedAt || new Date(),
                    timeTaken: candidateSubmission.timeTaken || 'N/A',
                    message: 'Your answers have been submitted successfully. Results will be calculated by the invigilator.'
                };
            }

            // Find candidate details from uploaded users
            const candidate = this.examData.users ? 
                this.examData.users.find(user => user.armyNumber === candidateSubmission.candidateId) : 
                null;

            // Get all answers for this candidate
            const candidateAnswers = this.examData.answers ? 
                Array.from(this.examData.answers.values()).filter(answer => answer.candidateId === candidateSubmission.candidateId) :
                [];

            let totalMarksObtained = 0;
            let totalMarksAvailable = 0;
            let totalQuestions = 0;

            try {
                totalMarksAvailable = this.examData.questions.reduce((sum, q) => sum + (q.marks || 0), 0);
                totalQuestions = this.examData.questions.length;
            } catch (reduceError) {
                console.error('Error calculating total marks:', reduceError);
                totalMarksAvailable = 0;
                totalQuestions = 0;
            }

            console.log(`📋 Processing ${candidateAnswers.length} answers for ${candidateSubmission.candidateId}`);
            console.log(`📊 Total marks available: ${totalMarksAvailable}`);

            candidateAnswers.forEach(answer => {
                try {
                    // Client sends 0-based IDs (0,1,2,3,4), server has 1-based IDs (1,2,3,4,5)
                    // Always add 1 to map correctly
                    const mappedQuestionId = parseInt(answer.questionId) + 1;
                    const question = this.examData.questions.find(q => q.id === mappedQuestionId);

                    if (!question) {
                        console.warn(`  ⚠️ Question not found: Client ID ${answer.questionId} → Server ID ${mappedQuestionId}`);
                        console.warn(`  Available question IDs:`, this.examData.questions.map(q => q.id));
                        return;
                    }

                    // Normalize answers for comparison (trim and convert to uppercase)
                    const normalizedCorrectAnswer = String(question.correctAnswer || '').trim().toUpperCase();
                    const normalizedSelectedAnswer = String(answer.selectedAnswer || '').trim().toUpperCase();
                    const isCorrect = normalizedCorrectAnswer === normalizedSelectedAnswer;
                    const marksForThisQuestion = question.marks || 0;

                    console.log(`  📝 Q${answer.questionId}→Q${mappedQuestionId}: Selected="${answer.selectedAnswer}" (normalized: "${normalizedSelectedAnswer}"), Correct="${question.correctAnswer}" (normalized: "${normalizedCorrectAnswer}"), Match=${isCorrect ? '✅' : '❌'}, Marks=${marksForThisQuestion}`);

                    if (isCorrect) {
                        totalMarksObtained += marksForThisQuestion;
                    }
                } catch (answerError) {
                    console.error(`Error processing answer for question ${answer.questionId}:`, answerError);
                }
            });

            const percentage = totalMarksAvailable > 0 ? (totalMarksObtained / totalMarksAvailable) * 100 : 0;
            const timeTaken = candidateSubmission.timeTaken || 'N/A';

            // Calculate grade based on percentage
            let grade = 'F';
            if (percentage >= 80) {
                grade = 'D';  // 80+ = D (Excellent)
            } else if (percentage >= 70) {
                grade = 'A';  // 70-79 = A (Very Good)
            } else if (percentage >= 60) {
                grade = 'B';  // 60-69 = B (Good)
            } else if (percentage >= 50) {
                grade = 'C';  // 50-59 = C (Average)
            } else if (percentage >= 40) {
                grade = 'E';  // 40-49 = E (Pass)
            } else {
                grade = 'F';  // <40 = F (Fail)
            }

            const result = {
                armyNumber: candidateSubmission.candidateId,
                name: candidate ? candidate.name : 'Unknown',
                rank: candidate ? candidate.rank : 'N/A',
                unit: candidate ? candidate.unit : 'N/A',
                score: totalMarksObtained,
                totalMarks: totalMarksAvailable,
                totalQuestions: totalQuestions,
                percentage: parseFloat(percentage.toFixed(2)),
                status: grade,  // Changed from PASS/FAIL to grade
                submittedAt: candidateSubmission.submittedAt || candidateSubmission.timestamp,
                timeTaken: timeTaken
            };

            console.log(`✅ Individual result calculated:`, result);
            return result;
        } catch (error) {
            console.error('❌ Critical error in calculateIndividualResult:', error);
            console.error('Error stack:', error.stack);
            
            // Return a safe fallback result
            return {
                armyNumber: candidateSubmission.candidateId,
                name: 'Candidate',
                rank: 'N/A',
                unit: 'N/A',
                score: 0,
                totalMarks: 0,
                totalQuestions: 0,
                percentage: 0,
                status: 'ERROR',
                submittedAt: candidateSubmission.submittedAt || new Date(),
                timeTaken: candidateSubmission.timeTaken || 'N/A',
                message: 'Error calculating result. Please contact the invigilator.',
                error: error.message
            };
        }
    }
}

module.exports = ExamServer;