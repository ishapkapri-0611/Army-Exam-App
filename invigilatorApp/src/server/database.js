const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const DocumentParser = require(path.join(__dirname, '..', '..', '..', 'shared-lib', 'utils', 'document-parser'));

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, 'exam.db');
        this.parser = new DocumentParser();
        this.init();
    }

    init() {
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('Database error:', err);
            } else {
                console.log('Connected to SQLite database');
                this.createTables();
            }
        });
    }

    createTables() {
        const queries = [
            `CREATE TABLE IF NOT EXISTS candidates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                army_number TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                rank TEXT,
                unit TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id TEXT UNIQUE NOT NULL,
                question_text TEXT NOT NULL,
                option_a TEXT,
                option_b TEXT,
                option_c TEXT,
                option_d TEXT,
                correct_answer TEXT NOT NULL,
                marks INTEGER DEFAULT 1,
                language TEXT DEFAULT 'english',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS exams (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                duration_minutes INTEGER,
                start_time DATETIME,
                end_time DATETIME,
                status TEXT DEFAULT 'draft',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS exam_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                exam_id INTEGER,
                start_time DATETIME,
                end_time DATETIME,
                is_active BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (exam_id) REFERENCES exams (id)
            )`,
            
            `CREATE TABLE IF NOT EXISTS candidate_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                candidate_id INTEGER,
                question_id INTEGER,
                exam_session_id INTEGER,
                selected_answer TEXT,
                is_correct BOOLEAN,
                answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                ip_address TEXT,
                FOREIGN KEY (candidate_id) REFERENCES candidates (id),
                FOREIGN KEY (question_id) REFERENCES questions (id),
                FOREIGN KEY (exam_session_id) REFERENCES exam_sessions (id),
                UNIQUE(candidate_id, question_id, exam_session_id)
            )`,
            
            `CREATE TABLE IF NOT EXISTS results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                candidate_id INTEGER,
                exam_session_id INTEGER,
                total_questions INTEGER,
                correct_answers INTEGER,
                score INTEGER,
                percentage REAL,
                time_taken INTEGER,
                submitted_at DATETIME,
                status TEXT DEFAULT 'submitted',
                FOREIGN KEY (candidate_id) REFERENCES candidates (id),
                FOREIGN KEY (exam_session_id) REFERENCES exam_sessions (id),
                UNIQUE(candidate_id, exam_session_id)
            )`
        ];

        queries.forEach((query, index) => {
            this.db.run(query, (err) => {
                if (err) {
                    console.error(`Error creating table ${index + 1}:`, err);
                } else {
                    console.log(`Table ${index + 1} created/verified successfully`);
                }
            });
        });
    }

    // Enhanced user import with proper error handling
    async importUsers(fileBuffer) {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('Starting user import from file buffer');
                
                let users;
                // Check if it's a Buffer (DOCX) or base64 string
                if (Buffer.isBuffer(fileBuffer)) {
                    users = await this.parser.parseUsersDocument(fileBuffer);
                } else {
                    // Handle base64 encoded content
                    const text = Buffer.from(fileBuffer, 'base64').toString();
                    users = await this.parser.parseUsersDocument(Buffer.from(text));
                }
                
                if (!users || users.length === 0) {
                    throw new Error('No valid users found in the document');
                }

                console.log(`Parsed ${users.length} users, starting database insertion`);

                const stmt = this.db.prepare(
                    "INSERT OR REPLACE INTO candidates (army_number, name, rank, unit) VALUES (?, ?, ?, ?)"
                );

                let insertedCount = 0;
                let errorCount = 0;

                for (const user of users) {
                    try {
                        await new Promise((resolveStmt, rejectStmt) => {
                            stmt.run([user.armyNumber, user.name, user.rank, user.unit], function(err) {
                                if (err) {
                                    console.error(`Error inserting user ${user.armyNumber}:`, err);
                                    errorCount++;
                                    resolveStmt(); // Continue with next user
                                } else {
                                    insertedCount++;
                                    resolveStmt();
                                }
                            });
                        });
                    } catch (userError) {
                        console.error(`Failed to insert user ${user.armyNumber}:`, userError);
                        errorCount++;
                    }
                }

                stmt.finalize((err) => {
                    if (err) {
                        console.error('Error finalizing statement:', err);
                    }
                    
                    console.log(`User import completed: ${insertedCount} inserted, ${errorCount} errors`);
                    
                    if (insertedCount === 0) {
                        reject(new Error('No users were imported successfully'));
                    } else {
                        resolve({
                            success: true,
                            imported: insertedCount,
                            errors: errorCount,
                            total: users.length,
                            users: users.slice(0, insertedCount) // Return successfully imported users
                        });
                    }
                });

            } catch (error) {
                console.error('Error in importUsers:', error);
                reject(error);
            }
        });
    }

    // Enhanced questions import
    async importQuestions(fileBuffer) {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('Starting questions import from file buffer');
                
                let questions;
                if (Buffer.isBuffer(fileBuffer)) {
                    questions = await this.parser.parseQuestionsDocument(fileBuffer);
                } else {
                    const text = Buffer.from(fileBuffer, 'base64').toString();
                    questions = await this.parser.parseQuestionsDocument(Buffer.from(text));
                }

                if (!questions || questions.length === 0) {
                    throw new Error('No valid questions found in the document');
                }

                console.log(`Parsed ${questions.length} questions, starting database insertion`);

                const stmt = this.db.prepare(
                    `INSERT OR REPLACE INTO questions (question_id, question_text, option_a, option_b, option_c, option_d, correct_answer, marks, language) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
                );

                let insertedCount = 0;
                let errorCount = 0;

                for (const q of questions) {
                    try {
                        const options = {
                            A: q.options?.find(opt => opt.letter === 'A')?.text || '',
                            B: q.options?.find(opt => opt.letter === 'B')?.text || '',
                            C: q.options?.find(opt => opt.letter === 'C')?.text || '',
                            D: q.options?.find(opt => opt.letter === 'D')?.text || ''
                        };

                        await new Promise((resolveStmt, rejectStmt) => {
                            stmt.run([
                                q.id || `Q${insertedCount + 1}`,
                                q.text,
                                options.A,
                                options.B,
                                options.C,
                                options.D,
                                q.correctAnswer,
                                q.marks || 1,
                                q.language || 'english'
                            ], function(err) {
                                if (err) {
                                    console.error(`Error inserting question ${q.id}:`, err);
                                    errorCount++;
                                    resolveStmt();
                                } else {
                                    insertedCount++;
                                    resolveStmt();
                                }
                            });
                        });
                    } catch (questionError) {
                        console.error(`Failed to insert question:`, questionError);
                        errorCount++;
                    }
                }

                stmt.finalize((err) => {
                    if (err) {
                        console.error('Error finalizing statement:', err);
                    }
                    
                    console.log(`Questions import completed: ${insertedCount} inserted, ${errorCount} errors`);
                    
                    if (insertedCount === 0) {
                        reject(new Error('No questions were imported successfully'));
                    } else {
                        resolve({
                            success: true,
                            imported: insertedCount,
                            errors: errorCount,
                            total: questions.length,
                            totalMarks: questions.reduce((sum, q) => sum + (q.marks || 1), 0)
                        });
                    }
                });

            } catch (error) {
                console.error('Error in importQuestions:', error);
                reject(error);
            }
        });
    }

    // Get all candidates
    async getAllCandidates() {
        return new Promise((resolve, reject) => {
            this.db.all(
                "SELECT * FROM candidates ORDER BY army_number",
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    // Get all questions
    async getAllQuestions() {
        return new Promise((resolve, reject) => {
            this.db.all(
                "SELECT * FROM questions ORDER BY question_id",
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    // Get candidate by army number
    async getCandidateByArmyNumber(armyNumber) {
        return new Promise((resolve, reject) => {
            this.db.get(
                "SELECT * FROM candidates WHERE army_number = ?",
                [armyNumber],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    // Save candidate answer
    async saveCandidateAnswer(candidateId, questionId, examSessionId, selectedAnswer, ipAddress = null) {
        return new Promise(async (resolve, reject) => {
            try {
                // Get the correct answer to check if the selected answer is correct
                const question = await new Promise((resolveQ, rejectQ) => {
                    this.db.get(
                        "SELECT correct_answer FROM questions WHERE id = ?",
                        [questionId],
                        (err, row) => {
                            if (err) rejectQ(err);
                            else resolveQ(row);
                        }
                    );
                });

                const isCorrect = question && question.correct_answer === selectedAnswer;

                this.db.run(
                    `INSERT OR REPLACE INTO candidate_answers 
                     (candidate_id, question_id, exam_session_id, selected_answer, is_correct, ip_address) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [candidateId, questionId, examSessionId, selectedAnswer, isCorrect ? 1 : 0, ipAddress],
                    function(err) {
                        if (err) reject(err);
                        else resolve({
                            id: this.lastID,
                            isCorrect: isCorrect
                        });
                    }
                );
            } catch (error) {
                reject(error);
            }
        });
    }

    // Calculate and save results
    async calculateResults(candidateId, examSessionId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    ca.candidate_id,
                    COUNT(*) as total_answered,
                    SUM(CASE WHEN ca.is_correct THEN 1 ELSE 0 END) as correct_answers,
                    SUM(q.marks) as total_possible_marks,
                    SUM(CASE WHEN ca.is_correct THEN q.marks ELSE 0 END) as score
                FROM candidate_answers ca
                JOIN questions q ON ca.question_id = q.id
                WHERE ca.candidate_id = ? AND ca.exam_session_id = ?
                GROUP BY ca.candidate_id
            `;

            this.db.get(query, [candidateId, examSessionId], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!row) {
                    resolve(null);
                    return;
                }

                const totalQuestions = row.total_answered;
                const correctAnswers = row.correct_answers;
                const score = row.score || 0;
                const totalMarks = row.total_possible_marks || totalQuestions;
                const percentage = totalMarks > 0 ? ((score / totalMarks) * 100).toFixed(2) : 0;

                // Save results
                this.db.run(
                    `INSERT OR REPLACE INTO results 
                     (candidate_id, exam_session_id, total_questions, correct_answers, score, percentage, submitted_at) 
                     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                    [candidateId, examSessionId, totalQuestions, correctAnswers, score, percentage],
                    function(err) {
                        if (err) reject(err);
                        else resolve({
                            candidateId: candidateId,
                            totalQuestions: totalQuestions,
                            correctAnswers: correctAnswers,
                            score: score,
                            totalMarks: totalMarks,
                            percentage: percentage,
                            status: percentage >= 50 ? 'PASS' : 'FAIL'
                        });
                    }
                );
            });
        });
    }

    // Get all results for export
    async getAllResults(examSessionId = null) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT 
                    c.army_number,
                    c.name,
                    c.rank,
                    c.unit,
                    r.total_questions,
                    r.correct_answers,
                    r.score,
                    r.percentage,
                    r.submitted_at,
                    CASE WHEN r.percentage >= 50 THEN 'PASS' ELSE 'FAIL' END as status
                FROM results r
                JOIN candidates c ON r.candidate_id = c.id
            `;

            const params = [];

            if (examSessionId) {
                query += " WHERE r.exam_session_id = ?";
                params.push(examSessionId);
            }

            query += " ORDER BY c.army_number";

            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Create exam session
    async createExamSession(examId, startTime = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                "INSERT INTO exam_sessions (exam_id, start_time, is_active) VALUES (?, ?, 1)",
                [examId, startTime || new Date().toISOString()],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    // Close database connection
    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }

    // Backup database
    backup(backupPath) {
        return new Promise((resolve, reject) => {
            const backupDb = new sqlite3.Database(backupPath);
            this.db.backup(backupDb, (err) => {
                if (err) reject(err);
                else {
                    backupDb.close();
                    resolve();
                }
            });
        });
    }
}

module.exports = Database;