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

        // Ensure data directory exists
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
            console.log(`📁 Created data directory: ${this.dataDir}`);
        }

        // Load existing data from disk on startup
        this.loadDataFromDisk();

        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
    }

    loadDataFromDisk() {
        console.log('📂 Loading data from disk...');

        // Load users
        const usersFilePath = path.join(this.dataDir, 'users.json');
        if (fs.existsSync(usersFilePath)) {
            try {
                const usersData = fs.readFileSync(usersFilePath, 'utf8');
                this.examData.users = JSON.parse(usersData);
                console.log(`✅ Loaded ${this.examData.users.length} users from disk`);
            } catch (error) {
                console.error('❌ Error loading users from disk:', error);
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
                this.examData.questions = JSON.parse(questionsData);
                const totalMarks = this.examData.questions.reduce((sum, q) => sum + (q.marks || 0), 0);
                console.log(`✅ Loaded ${this.examData.questions.length} questions from disk (${totalMarks} total marks)`);

                // Debug: Show loaded questions
                console.log('📋 Loaded questions details:');
                this.examData.questions.forEach(q => {
                    console.log(`  Q${q.id}: "${q.text.substring(0, 30)}..." → Correct: ${q.correctAnswer}`);
                });
            } catch (error) {
                console.error('❌ Error loading questions from disk:', error);
            }
        } else {
            console.log('📄 No questions file found on disk');
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
                res.json({
                    success: true,
                    submissions: submissions,
                    summary: {
                        totalSubmissions: submissions.length,
                        totalQuestions: this.examData.questions.length,
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
                const armyNumberPattern = /^[A-Z]{2}\d{6}[A-Z]?$/;
                if (!armyNumberPattern.test(armyNumber)) {
                    return res.json({
                        success: false,
                        error: 'Invalid Army Number format (expected format: JC543031A)'
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

                    // Save to disk for persistence
                    const questionsFilePath = path.join(this.dataDir, 'questions.json');
                    fs.writeFileSync(questionsFilePath, JSON.stringify(questions, null, 2));
                    console.log(`✅ Questions saved to disk: ${questionsFilePath}`);

                    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
                    console.log(`📊 Total marks: ${totalMarks}`);
                    res.json({ success: true, count: questions.length });
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
                const answersArray = Array.from(this.examData.answers.values());
                fs.writeFileSync(this.answersFilePath, JSON.stringify(answersArray, null, 2));

                console.log(`✅ Stored ${answersToProcess.length} answers for ${armyNumber}`);
                res.json({
                    success: true,
                    message: 'Exam submitted successfully',
                    answersCount: answersToProcess.length,
                    candidateId: armyNumber
                });
            } catch (error) {
                console.error('Exam submission error:', error);
                res.status(500).json({ success: false, error: 'Internal server error' });
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

        const submissions = new Map();

        // Process all answers
        for (const [key, value] of this.examData.answers.entries()) {
            const { candidateId, questionId, selectedAnswer, timestamp } = value;

            if (!submissions.has(candidateId)) {
                // Find candidate details from uploaded users
                const candidate = this.examData.users.find(user => user.armyNumber === candidateId);

                submissions.set(candidateId, {
                    candidateId: candidateId,
                    name: candidate ? candidate.name : 'Unknown',
                    rank: candidate ? candidate.rank : 'N/A',
                    unit: candidate ? candidate.unit : 'N/A',
                    armyNumber: candidateId,
                    answers: [],
                    score: 0,
                    totalQuestions: this.examData.questions.length,
                    submittedAt: timestamp
                });
            }

            submissions.get(candidateId).answers.push({
                questionId: questionId,
                selectedAnswer: selectedAnswer,
                timestamp: timestamp
            });
        }

        // Calculate scores for each submission
        const submissionsArray = Array.from(submissions.values());

        submissionsArray.forEach(submission => {
            let correctAnswers = 0;

            console.log(`🔍 Calculating score for ${submission.candidateId}:`);
            console.log(`📋 Available questions in memory: ${this.examData.questions.length}`);
            this.examData.questions.forEach(q => {
                console.log(`  Q${q.id}: Correct answer = ${q.correctAnswer}`);
            });

            submission.answers.forEach(answer => {
                // Always map 0-based answer IDs to 1-based server question IDs
                // Since server questions are always 1,2,3,4,5 and answers are 0,1,2,3,4
                const mappedQuestionId = answer.questionId + 1;
                const question = this.examData.questions.find(q => q.id === mappedQuestionId);

                const isCorrect = question && question.correctAnswer === answer.selectedAnswer;
                console.log(`  📝 Q${answer.questionId}→Q${mappedQuestionId}: Selected=${answer.selectedAnswer}, Correct=${question ? question.correctAnswer : 'NOT FOUND'}, Match=${isCorrect ? '✅' : '❌'}`);

                if (isCorrect) {
                    correctAnswers++;
                }
            });

            console.log(`✅ Final score for ${submission.candidateId}: ${correctAnswers}/${submission.totalQuestions}`);

            submission.score = correctAnswers;
            submission.percentage = submission.totalQuestions > 0
                ? ((correctAnswers / submission.totalQuestions) * 100).toFixed(2)
                : 0;
        });

        console.log(`Found ${submissionsArray.length} submissions with scores`);
        return submissionsArray;
    }

    generateCSV(submissions) {
        const headers = ['Army Number', 'Name', 'Rank', 'Unit', 'Score', 'Total Questions', 'Percentage', 'Submission Time'];
        let csv = headers.join(',') + '\n';

        submissions.forEach(submission => {
            const row = [
                `"${submission.armyNumber}"`,
                `"${submission.name}"`,
                `"${submission.rank}"`,
                `"${submission.unit}"`,
                submission.score,
                submission.totalQuestions,
                submission.percentage,
                `"${new Date(submission.submittedAt).toLocaleString()}"`
            ];
            csv += row.join(',') + '\n';
        });

        return csv;
    }

    startExam(questions, duration = 60) {
        if (questions && Array.isArray(questions)) {
            this.examData.questions = questions;
        }
        this.examData.startTime = new Date();
        this.examData.duration = duration;

        console.log(`🚀 Exam started! Duration: ${duration} minutes`);

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
        return new Promise((resolve) => {
            if (!this.isRunning) {
                resolve();
                return;
            }

            this.server.close((err) => {
                if (err) {
                    console.error('Error stopping server:', err);
                } else {
                    this.isRunning = false;
                    this.startTime = null;
                    this.connectedCandidates.clear();
                    console.log('✅ Exam server stopped successfully');
                }
                resolve();
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
}

module.exports = ExamServer;