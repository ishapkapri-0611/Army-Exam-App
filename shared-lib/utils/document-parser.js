const mammoth = require('mammoth');
const { isValidArmyNumber } = require('./validation');

class DocumentParser {
    constructor() {
        console.log('DocumentParser initialized');
    }

    // Parse Users Document with JC543031A or 145699Z format
    async parseUsersDocument(fileBuffer) {
        try {
            console.log('📁 Starting users document parsing...');
            
            if (!fileBuffer || fileBuffer.length === 0) {
                throw new Error('Empty file buffer provided');
            }

            // Extract text from DOCX using mammoth
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            const text = result.value;
            
            console.log('📄 Raw text extracted, length:', text.length);
            
            const lines = text.split('\n').filter(line => line.trim());
            const users = [];
            
            console.log(`🔍 Found ${lines.length} lines to process`);
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                try {
                    // Expected format: JC543031A or 145699Z, John Doe, Captain, Unit 1
                    const parts = line.split(',').map(part => part.trim());
                    
                    if (parts.length >= 3) {
                        const armyNumber = parts[0].trim();
                        const name = parts[1].trim();
                        const rank = parts[2].trim();
                        const unit = parts[3] ? parts[3].trim() : 'N/A';
                        
                        // Validate Army Number format (supports both JC543031A and 145699Z patterns)
                        if (this.isValidArmyNumber(armyNumber)) {
                            users.push({
                                armyNumber: armyNumber,
                                name: name,
                                rank: rank,
                                unit: unit,
                                lineNumber: i + 1
                            });
                            console.log(`✅ Added user: ${armyNumber} - ${name}`);
                        } else {
                            console.warn(`⚠️ Invalid Army Number format at line ${i + 1}: ${armyNumber}`);
                        }
                    } else {
                        console.warn(`⚠️ Skipping line ${i + 1} - insufficient data: ${line}`);
                    }
                } catch (lineError) {
                    console.error(`❌ Error processing line ${i + 1}:`, lineError);
                }
            }
            
            console.log(`🎉 Successfully parsed ${users.length} users from document`);
            return users;
            
        } catch (error) {
            console.error('💥 Critical error parsing users document:', error);
            throw new Error(`Failed to parse users document: ${error.message}`);
        }
    }

    // Enhanced Questions Document Parser with improved MCQ, True/False and Image support
    async parseQuestionsDocument(fileBuffer) {
        try {
            console.log('📝 Starting enhanced questions document parsing...');
            
            if (!fileBuffer || fileBuffer.length === 0) {
                throw new Error('Empty file buffer provided');
            }

            // --- Step 1: Extract HTML with embedded base64 images ---
            const imageMap = new Map();
            let imageCounter = 0;

            const htmlResult = await mammoth.convertToHtml(
                { buffer: fileBuffer },
                {
                    convertImage: mammoth.images.imgElement(async (image) => {
                        try {
                            const imageBuffer = await image.read('base64');
                            const dataUri = `data:${image.contentType};base64,${imageBuffer}`;
                            const placeholder = `__IMG_${imageCounter++}__`;
                            imageMap.set(placeholder, dataUri);
                            return { src: placeholder };
                        } catch (imgErr) {
                            console.warn('⚠️ Could not process image:', imgErr.message);
                            return { src: '' };
                        }
                    })
                }
            );

            // --- Step 2: Also extract plain text for line-based parsing ---
            const textResult = await mammoth.extractRawText({ buffer: fileBuffer });
            const text = textResult.value;

            console.log('📄 Raw text extracted, length:', text.length);
            console.log(`🖼️  Images found in document: ${imageMap.size}`);

            const htmlContent = htmlResult.value;
            const imagePlaceholders = [];
            imageMap.forEach((_, placeholder) => {
                const idx = htmlContent.indexOf(placeholder);
                if (idx !== -1) imagePlaceholders.push({ placeholder, idx });
            });
            imagePlaceholders.sort((a, b) => a.idx - b.idx);

            // --- Step 3: Parse text as before ---
            const cleanedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

            const htmlParagraphs = htmlContent
                .split(/<\/p>|<\/li>/)
                .map(p => p.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
                .filter(p => p.length > 0);
            
            // Parse line-by-line — images create empty lines in raw text which break
            // block-based splitting, so we process each line individually and skip empties
            const allLines = cleanedText.split('\n').map(line => line.trim());
            const questions = [];
            let currentQuestion = null;
            let questionNumber = 1;

            console.log(`🔍 Found ${allLines.length} lines to process`);

            for (let i = 0; i < allLines.length; i++) {
                const line = allLines[i];
                if (!line) continue;

                try {
                    if (this.isQuestionLine(line)) {
                        if (currentQuestion) {
                            this.finalizeQuestion(currentQuestion);
                            questions.push(currentQuestion);
                            console.log(`✅ Completed Q${currentQuestion.id}: ${currentQuestion.text.substring(0, 50)}...`);
                        }
                        currentQuestion = this.createEnhancedQuestionFromLine(line, questionNumber);
                        questionNumber++;
                        console.log(`🆕 New question: ${currentQuestion.text.substring(0, 50)}...`);
                    } else if (currentQuestion) {
                        this.processEnhancedQuestionLines(currentQuestion, [line]);
                    }
                } catch (lineError) {
                    console.error(`❌ Error processing line ${i + 1}:`, lineError);
                }
            }

            if (currentQuestion) {
                this.finalizeQuestion(currentQuestion);
                questions.push(currentQuestion);
                console.log(`✅ Completed final Q${currentQuestion.id}`);
            }

            console.log(`🎉 Successfully parsed ${questions.length} questions`);
            
            // Check if any questions were parsed
            if (questions.length === 0) {
                console.log('⚠️ No questions found with block parsing, trying line-by-line parsing...');
                
                // Fallback: Try line-by-line parsing
                const fallbackQuestions = this.parseQuestionsLineByLine(cleanedText);
                if (fallbackQuestions.length > 0) {
                    console.log(`✅ Fallback parsing found ${fallbackQuestions.length} questions`);
                    questions.push(...fallbackQuestions);
                } else {
                    console.log('❌ Both parsing methods failed');
                    const error = new Error('No valid questions found in the document. Please check the format.');
                    error.details = {
                        requiredFormat: 'Questions must start with Q1, Question 1, or 1) followed by text and [marks]',
                        example: 'Q1. What is the capital of France? [2 marks]\nA. Paris\nB. London\nCorrect Answer: A',
                        supportedFormats: [
                            'Q1. Question text [2 marks]',
                            '1. Question text (2 marks)',
                            'Question 1: Question text',
                            '1) Question text'
                        ]
                    };
                    throw error;
                }
            }
            
            // Validate all questions have required data
            const validation = this.validateQuestions(questions);
            if (validation.errors.length > 0) {
                console.warn('⚠️ Validation warnings:', validation.errors);
            }

            // --- Step 4: Assign images to questions ---
            if (imageMap.size > 0) {
                const questionParagraphIndex = questions.map(q => {
                    const searchText = q.rawText ? q.rawText.substring(0, 40).toLowerCase() : '';
                    const idx = htmlParagraphs.findIndex(p => p.toLowerCase().includes(searchText));
                    return idx === -1 ? 0 : idx;
                });

                imagePlaceholders.forEach(({ placeholder }) => {
                    const dataUri = imageMap.get(placeholder);
                    if (!dataUri) return;
                    const paraIdx = htmlParagraphs.findIndex(p => p.includes(placeholder));
                    let bestQ = null;
                    let bestDiff = Infinity;
                    questions.forEach((q, qi) => {
                        const diff = paraIdx - questionParagraphIndex[qi];
                        if (diff >= 0 && diff < bestDiff) { bestDiff = diff; bestQ = q; }
                    });
                    const target = bestQ || (questions.length > 0 ? questions[questions.length - 1] : null);
                    if (target) {
                        if (!target.images) target.images = [];
                        target.images.push(dataUri);
                        console.log(`🖼️  Assigned image to question ${target.id}`);
                    }
                });
            }

            return questions;
            
        } catch (error) {
            console.error('💥 Critical error parsing questions document:', error);
            throw new Error(`Failed to parse questions document: ${error.message}`);
        }
    }

    // Fallback line-by-line parsing method
    parseQuestionsLineByLine(text) {
        console.log('🔄 Starting line-by-line parsing fallback...');
        
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        const questions = [];
        let currentQuestion = null;
        let questionNumber = 1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (this.isQuestionLine(line)) {
                // Save previous question
                if (currentQuestion) {
                    this.finalizeQuestion(currentQuestion);
                    questions.push(currentQuestion);
                }
                
                // Start new question
                currentQuestion = this.createEnhancedQuestionFromLine(line, questionNumber);
                questionNumber++;
                console.log(`🆕 Fallback: New question detected: ${currentQuestion.text.substring(0, 50)}...`);
                
            } else if (currentQuestion) {
                // Process as option or answer
                if (this.isEnhancedOptionLine(line)) {
                    this.processEnhancedOptionLine(currentQuestion, line);
                } else if (this.isEnhancedAnswerLine(line)) {
                    this.processEnhancedAnswerLine(currentQuestion, line);
                }
            }
        }
        
        // Don't forget the last question
        if (currentQuestion) {
            this.finalizeQuestion(currentQuestion);
            questions.push(currentQuestion);
        }
        
        console.log(`✅ Line-by-line parsing found ${questions.length} questions`);
        return questions;
    }

    // Enhanced question line detection - more flexible
    isQuestionLine(line) {
        // More flexible patterns to detect question lines
        const patterns = [
            /^(Q|Question|\d+)[\.\)\:\s]/,           // Q1., Question 1., 1), etc.
            /^\d+[\.\)]\s/,                          // 1. 2) etc.
            /^Question\s+\d+/i,                      // Question 1, Question 2
            /^Q\d+/i,                                // Q1, Q2, Q3
            /^\d+\.\s*[A-Z]/,                        // 1. What is... (starts with capital)
            /^\d+\)\s*[A-Z]/                         // 1) What is... (starts with capital)
        ];
        
        return patterns.some(pattern => pattern.test(line.trim()));
    }

    createEnhancedQuestionFromLine(line, questionNumber) {
        // Enhanced question text extraction - handles more formats
        let questionText = line.trim();
        
        // Remove various question prefixes
        const prefixes = [
            /^(Q|Question|\d+)[\.\)\:\s]*/i,           // Q1., Question 1., 1), etc.
            /^\d+[\.\)]\s*/i,                          // 1. 2) etc.
            /^Question\s+\d+[\.\)\:\s]*/i,             // Question 1, Question 2
            /^Q\d+[\.\)\:\s]*/i                        // Q1, Q2, Q3
        ];
        
        for (const prefix of prefixes) {
            questionText = questionText.replace(prefix, '').trim();
        }
        
        let marks = 1;
        let text = questionText;
        
        // Enhanced marks extraction - supports multiple formats
        const marksPatterns = [
            /\[(\d+)\s*marks?\]/i,           // [2 marks] or [2 mark]
            /\((\d+)\s*marks?\)/i,           // (2 marks) or (2 mark)
            /\[(\d+)\s*marks?\]/i,           // [2 marks] with different spacing
            /(\d+)\s*marks?/i                // 2 marks (without brackets)
        ];
        
        for (const pattern of marksPatterns) {
            const marksMatch = questionText.match(pattern);
            if (marksMatch) {
                marks = parseInt(marksMatch[1]);
                text = questionText.replace(pattern, '').trim();
                break;
            }
        }
        
        // Detect question type - enhanced logic
        const lowerText = text.toLowerCase();
        let type = 'mcq';
        
        // Check for True/False patterns
        if (lowerText.includes('true') && lowerText.includes('false')) {
            type = 'truefalse';
        } else if (lowerText.includes('correct') || lowerText.includes('incorrect')) {
            type = 'mcq';
        }
        
        // Detect language
        const language = /[\u0900-\u097F]/.test(line) ? 'hindi' : 'english';

        return {
            id: questionNumber,
            text: text,
            type: type,
            options: [],
            correctAnswer: '',
            marks: marks,
            language: language,
            rawText: line,
            difficulty: this.detectDifficulty(text),
            category: this.detectCategory(text)
        };
    }

    processEnhancedQuestionLines(question, lines) {
        const autoLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            if (this.isEnhancedOptionLine(trimmedLine)) {
                this.processEnhancedOptionLine(question, trimmedLine);
            } else if (this.isEnhancedAnswerLine(trimmedLine)) {
                this.processEnhancedAnswerLine(question, trimmedLine);
            } else if (this.isExplanationLine(trimmedLine)) {
                this.processExplanationLine(question, trimmedLine);
            } else if (!this.isQuestionLine(trimmedLine)) {
                // Bare list item — Word auto-lettered lists lose A/B/C/D in raw text
                const nextLetter = autoLetters[question.options.length];
                if (nextLetter && question.options.length < 6) {
                    const hasExplicitOptions = question.options.some(o => o.explicit);
                    if (!hasExplicitOptions) {
                        question.options.push({
                            letter: nextLetter,
                            text: trimmedLine,
                            isCorrect: false,
                            explicit: false
                        });
                        console.log(`📋 Auto-assigned option ${nextLetter}: ${trimmedLine.substring(0, 30)}`);
                    }
                }
            }
        }
    }

    // Enhanced option line detection
    isEnhancedOptionLine(line) {
        return /^[A-D][\.\)\:\s]\s*.+/.test(line) || 
               /^(True|False)/i.test(line) ||
               /^[A-D]\s+/.test(line) ||
               /^[a-d][\.\)\:\s]\s*.+/.test(line);
    }

    // Enhanced answer line detection
    isEnhancedAnswerLine(line) {
        return /Correct Answer:\s*[A-D]/i.test(line) || 
               /उत्तर:\s*[A-D]/i.test(line) ||
               /Answer:\s*[A-D]/i.test(line) ||
               /Key:\s*[A-D]/i.test(line) ||
               /Solution:\s*[A-D]/i.test(line);
    }

    // Check for explanation lines
    isExplanationLine(line) {
        return /Explanation:/i.test(line) ||
               /Reason:/i.test(line) ||
               /Note:/i.test(line) ||
               /Hint:/i.test(line);
    }

    processEnhancedOptionLine(question, line) {
        let optionLetter, optionText;

        if (/^True/i.test(line)) {
            optionLetter = 'A';
            optionText = 'True';
        } else if (/^False/i.test(line)) {
            optionLetter = 'B';
            optionText = 'False';
        } else {
            // Enhanced option letter extraction
            optionLetter = line[0].toUpperCase();
            optionText = line.replace(/^[A-Da-d][\.\)\:\s]\s*/, '').trim();
        }

        // Remove any "Correct" indicators from option text
        optionText = optionText.replace(/\s*\(Correct\)\s*/i, '')
                              .replace(/\s*\(सही\)\s*/i, '')
                              .replace(/\s*✓\s*/g, '')
                              .replace(/\s*\*correct\*\s*/i, '')
                              .trim();

        question.options.push({
            letter: optionLetter,
            text: optionText,
            isCorrect: false,
            explicit: true
        });

        console.log(`📋 Added option ${optionLetter}: ${optionText.substring(0, 30)}...`);
    }

    processEnhancedAnswerLine(question, line) {
        const answerPatterns = [
            /Correct Answer:\s*([A-D])/i,
            /उत्तर:\s*([A-D])/i,
            /Answer:\s*([A-D])/i,
            /Key:\s*([A-D])/i,
            /Solution:\s*([A-D])/i
        ];

        for (const pattern of answerPatterns) {
            const answerMatch = line.match(pattern);
            if (answerMatch) {
                question.correctAnswer = answerMatch[1].toUpperCase();
                console.log(`🎯 Set correct answer for question ${question.id}: ${answerMatch[1].toUpperCase()}`);
                
                // Mark the correct option
                question.options.forEach(option => {
                    if (option.letter === question.correctAnswer) {
                        option.isCorrect = true;
                    }
                });
                break;
            }
        }
    }

    processExplanationLine(question, line) {
        if (!question.explanation) {
            question.explanation = '';
        }
        
        const explanationText = line.replace(/^(Explanation|Reason|Note|Hint):\s*/i, '').trim();
        if (explanationText) {
            question.explanation += (question.explanation ? ' ' : '') + explanationText;
            console.log(`📝 Added explanation for question ${question.id}`);
        }
    }

    isAnswerLine(line) {
        return /Correct Answer:\s*[A-D]/i.test(line) || /उत्तर:\s*[A-D]/i.test(line);
    }

    processAnswerLine(question, line) {
        const answerMatch = line.match(/Correct Answer:\s*([A-D])/i) || line.match(/उत्तर:\s*([A-D])/i);
        if (answerMatch) {
            question.correctAnswer = answerMatch[1];
            console.log(`🎯 Set correct answer for question ${question.id}: ${answerMatch[1]}`);
        }
    }

    finalizeQuestion(question) {
        // For True/False questions, ensure we have both options
        if (question.type === 'truefalse' && question.options.length === 0) {
            question.options = [
                { letter: 'A', text: 'True', isCorrect: false },
                { letter: 'B', text: 'False', isCorrect: false }
            ];
            console.log(`🔧 Added default True/False options for question ${question.id}`);
        }

        // If no correct answer found in answer lines, check options for indicators
        if (!question.correctAnswer) {
            for (const option of question.options) {
                if (option.text.includes('(Correct)') || option.text.includes('(सही)')) {
                    question.correctAnswer = option.letter;
                    option.isCorrect = true;
                    console.log(`🎯 Found correct answer from option text: ${option.letter}`);
                    break;
                }
            }
        }

        // Ensure all options have isCorrect property
        question.options.forEach(option => {
            if (option.isCorrect === undefined) {
                option.isCorrect = (option.letter === question.correctAnswer);
            }
        });

        // Add metadata
        question.totalOptions = question.options.length;
        question.parsedAt = new Date().toISOString();
    }

    // Helper method to detect question difficulty
    detectDifficulty(text) {
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes('explain') || lowerText.includes('analyze') || lowerText.includes('compare')) {
            return 'hard';
        } else if (lowerText.includes('what') || lowerText.includes('which') || lowerText.includes('who')) {
            return 'medium';
        } else {
            return 'easy';
        }
    }

    // Helper method to detect question category
    detectCategory(text) {
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes('army') || lowerText.includes('military') || lowerText.includes('soldier')) {
            return 'military';
        } else if (lowerText.includes('math') || lowerText.includes('calculate') || lowerText.includes('number')) {
            return 'mathematics';
        } else if (lowerText.includes('english') || lowerText.includes('grammar') || lowerText.includes('language')) {
            return 'english';
        } else if (lowerText.includes('science') || lowerText.includes('physics') || lowerText.includes('chemistry')) {
            return 'science';
        } else {
            return 'general';
        }
    }

    // Validate Army Number format — delegates to shared validation utility
    isValidArmyNumber(armyNumber) {
        return isValidArmyNumber(armyNumber);
    }

    validateQuestions(questions) {
        const errors = [];
        const warnings = [];
        
        questions.forEach((q, index) => {
            if (!q.text || q.text.trim() === '') {
                errors.push(`Question ${index + 1} has no text`);
            }
            
            if (q.options.length < 2) {
                errors.push(`Question ${index + 1} has less than 2 options`);
            }
            
            if (!q.correctAnswer) {
                warnings.push(`Question ${index + 1} has no correct answer specified`);
            }
            
            if (q.marks <= 0) {
                errors.push(`Question ${index + 1} has invalid marks: ${q.marks}`);
            }
            
            // Check for duplicate options
            const letters = q.options.map(opt => opt.letter);
            const uniqueLetters = new Set(letters);
            if (letters.length !== uniqueLetters.size) {
                errors.push(`Question ${index + 1} has duplicate options`);
            }
            
            // Enhanced validation for MCQ format
            if (q.type === 'mcq' && q.options.length < 2) {
                errors.push(`Question ${index + 1}: MCQ must have at least 2 options`);
            }
            
            // Validate True/False format
            if (q.type === 'truefalse' && q.options.length !== 2) {
                warnings.push(`Question ${index + 1}: True/False should have exactly 2 options, found ${q.options.length}`);
            }
            
            // Check for empty options
            q.options.forEach((option, optIndex) => {
                if (!option.text || option.text.trim() === '') {
                    errors.push(`Question ${index + 1}, Option ${option.letter} is empty`);
                }
            });
            
            // Validate correct answer exists in options
            if (q.correctAnswer && q.options.length > 0) {
                const correctOption = q.options.find(opt => opt.letter === q.correctAnswer);
                if (!correctOption) {
                    errors.push(`Question ${index + 1}: Correct answer '${q.correctAnswer}' not found in options`);
                }
            }
        });
        
        return { 
            errors, 
            warnings, 
            isValid: errors.length === 0,
            totalQuestions: questions.length,
            totalMarks: questions.reduce((sum, q) => sum + q.marks, 0),
            mcqCount: questions.filter(q => q.type === 'mcq').length,
            trueFalseCount: questions.filter(q => q.type === 'truefalse').length
        };
    }

    // Calculate results based on answers and question marks
    calculateResults(candidateAnswers, questions, candidates) {
        console.log('🧮 Starting results calculation...');
        console.log(`📊 Input: ${candidates.length} candidates, ${questions.length} questions, ${candidateAnswers.length} answers`);

        const results = [];
        let totalPossibleMarks = 0;

        // Calculate total possible marks
        questions.forEach(q => {
            totalPossibleMarks += q.marks;
        });

        console.log(`📈 Total possible marks: ${totalPossibleMarks}`);

        candidates.forEach(candidate => {
            const candidateId = candidate.armyNumber;
            const candidateAnswerSet = candidateAnswers.filter(a => a.candidateId === candidateId);
            
            let obtainedMarks = 0;
            let questionsAttempted = 0;
            let correctAnswers = 0;

            console.log(`\n🔍 Calculating marks for ${candidateId} (${candidateAnswerSet.length} answers)`);

            questions.forEach(question => {
                const candidateAnswer = candidateAnswerSet.find(a => a.questionId === question.id);
                
                if (candidateAnswer) {
                    questionsAttempted++;
                    
                    if (candidateAnswer.selectedAnswer === question.correctAnswer) {
                        obtainedMarks += question.marks;
                        correctAnswers++;
                        console.log(`✅ Q${question.id}: Correct +${question.marks} marks`);
                    } else {
                        console.log(`❌ Q${question.id}: Incorrect (Expected: ${question.correctAnswer}, Got: ${candidateAnswer.selectedAnswer})`);
                    }
                } else {
                    console.log(`➖ Q${question.id}: Not attempted`);
                }
            });

            const percentage = totalPossibleMarks > 0 ? (obtainedMarks / totalPossibleMarks) * 100 : 0;
            
            // Calculate grade based on percentage
            let grade = 'F';
            if (percentage >= 80) {
                grade = 'D';  // 80+ = D
            } else if (percentage >= 70) {
                grade = 'A';  // 70-79 = A
            } else if (percentage >= 60) {
                grade = 'B';  // 60-69 = B
            } else if (percentage >= 50) {
                grade = 'C';  // 50-59 = C
            } else if (percentage >= 40) {
                grade = 'E';  // 40-49 = E
            } else {
                grade = 'F';  // <40 = F
            }

            const result = {
                armyNumber: candidate.armyNumber,
                rank: candidate.rank,
                name: candidate.name,
                unit: candidate.unit,
                totalScore: obtainedMarks,
                maxMarks: totalPossibleMarks,
                percentage: percentage.toFixed(2),
                status: grade,  // Changed from PASS/FAIL to grade
                questionsAttempted: questionsAttempted,
                correctAnswers: correctAnswers,
                totalQuestions: questions.length,
                accuracy: questionsAttempted > 0 ? ((correctAnswers / questionsAttempted) * 100).toFixed(2) : '0.00'
            };

            results.push(result);
            console.log(`📋 ${candidateId}: ${obtainedMarks}/${totalPossibleMarks} = ${percentage.toFixed(2)}% (${status})`);
        });

        // Sort by percentage (descending)
        const sortedResults = results.sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
        
        console.log(`\n🎉 Results calculation completed for ${sortedResults.length} candidates`);
        
        // Print summary
        const passCount = sortedResults.filter(r => r.status !== 'F').length;  // Count all grades except F
        const averagePercentage = sortedResults.reduce((sum, r) => sum + parseFloat(r.percentage), 0) / sortedResults.length;
        
        console.log(`📊 Summary: ${passCount}/${sortedResults.length} passed, Average: ${averagePercentage.toFixed(2)}%`);
        
        return sortedResults;
    }

    // Generate Results Word Document
    async generateResultsDocument(results, examTitle = 'Army Examination Results') {
        try {
            // Check if docx package is available
            let docxModule;
            try {
                docxModule = require('docx');
            } catch (docxError) {
                throw new Error('docx package is not installed. Please install it with: npm install docx');
            }
            
            const { Document, Paragraph, Table, TableCell, TableRow, HeadingLevel, AlignmentType } = docxModule;
            
            console.log('📄 Generating Word document for results...');

            if (!results || results.length === 0) {
                throw new Error('No results data available for export');
            }

            // Define column widths (in DXA units - 1440 DXA = 1 inch)
            const { WidthType } = docxModule;
            const columnWidths = [
                1200,  // Army Number
                1000,  // Rank
                2000,  // Name (wider to prevent wrapping)
                1500,  // Unit (wider to prevent wrapping)
                800,   // Total Marks
                800,   // Marks Obtained
                800,   // Percentage
                700,   // Status
                1200   // Date of Exam (wider for longer text)
            ];

            // Create table headers
            const tableRows = [
                new TableRow({
                    children: [
                        new TableCell({ 
                            children: [new Paragraph({ 
                                text: "Army Number", 
                                bold: true,
                                spacing: { before: 100, after: 100 }
                            })],
                            width: { size: columnWidths[0], type: WidthType.DXA },
                            margins: { top: 100, bottom: 100, left: 100, right: 100 }
                        }),
                        new TableCell({ 
                            children: [new Paragraph({ 
                                text: "Rank", 
                                bold: true,
                                spacing: { before: 100, after: 100 }
                            })],
                            width: { size: columnWidths[1], type: WidthType.DXA },
                            margins: { top: 100, bottom: 100, left: 100, right: 100 }
                        }),
                        new TableCell({ 
                            children: [new Paragraph({ 
                                text: "Name", 
                                bold: true,
                                spacing: { before: 100, after: 100 }
                            })],
                            width: { size: columnWidths[2], type: WidthType.DXA },
                            margins: { top: 100, bottom: 100, left: 100, right: 100 }
                        }),
                        new TableCell({ 
                            children: [new Paragraph({ 
                                text: "Unit", 
                                bold: true,
                                spacing: { before: 100, after: 100 }
                            })],
                            width: { size: columnWidths[3], type: WidthType.DXA },
                            margins: { top: 100, bottom: 100, left: 100, right: 100 }
                        }),
                        new TableCell({ 
                            children: [new Paragraph({ 
                                text: "Total Marks", 
                                bold: true,
                                spacing: { before: 100, after: 100 }
                            })],
                            width: { size: columnWidths[4], type: WidthType.DXA },
                            margins: { top: 100, bottom: 100, left: 100, right: 100 }
                        }),
                        new TableCell({ 
                            children: [new Paragraph({ 
                                text: "Marks Obtained", 
                                bold: true,
                                spacing: { before: 100, after: 100 }
                            })],
                            width: { size: columnWidths[5], type: WidthType.DXA },
                            margins: { top: 100, bottom: 100, left: 100, right: 100 }
                        }),
                        new TableCell({ 
                            children: [new Paragraph({ 
                                text: "Percentage", 
                                bold: true,
                                spacing: { before: 100, after: 100 }
                            })],
                            width: { size: columnWidths[6], type: WidthType.DXA },
                            margins: { top: 100, bottom: 100, left: 100, right: 100 }
                        }),
                        new TableCell({ 
                            children: [new Paragraph({ 
                                text: "Grade", 
                                bold: true,
                                spacing: { before: 100, after: 100 }
                            })],
                            width: { size: columnWidths[7], type: WidthType.DXA },
                            margins: { top: 100, bottom: 100, left: 100, right: 100 }
                        }),
                        new TableCell({ 
                            children: [new Paragraph({ 
                                text: "Date of Exam", 
                                bold: true,
                                spacing: { before: 100, after: 100 }
                            })],
                            width: { size: columnWidths[8], type: WidthType.DXA },
                            margins: { top: 100, bottom: 100, left: 100, right: 100 }
                        })
                    ]
                })
            ];

            // Add result rows
            console.log(`📋 Adding ${results.length} result rows to table...`);
            results.forEach((result, index) => {
                console.log(`📝 Processing row ${index + 1}:`, {
                    armyNumber: result.armyNumber,
                    name: result.name,
                    rank: result.rank,
                    unit: result.unit,
                    score: result.score,
                    totalQuestions: result.totalQuestions,
                    percentage: result.percentage,
                    status: result.status
                });
                
                const rowData = [
                    result.armyNumber || 'N/A',
                    result.rank || 'N/A', 
                    result.name || 'N/A',
                    result.unit || 'N/A',
                    `${result.totalMarks || result.maxMarks || result.totalQuestions || 10}`,  // Total Marks first
                    `${result.totalScore || result.score || 0}`,  // Marks Obtained second
                    (result.percentage || '0') + '%',
                    result.status || 'N/A',
                    new Date().toLocaleDateString()
                ];
                
                console.log(`📊 Row ${index + 1} data:`, rowData);
                
                tableRows.push(
                    new TableRow({
                        children: rowData.map((cellText, colIndex) => 
                            new TableCell({ 
                                children: [new Paragraph({ 
                                    text: String(cellText),
                                    spacing: { before: 100, after: 100 }
                                })],
                                width: { size: columnWidths[colIndex], type: WidthType.DXA },
                                margins: {
                                    top: 100,
                                    bottom: 100,
                                    left: 100,
                                    right: 100
                                }
                            })
                        )
                    })
                );
            });
            
            console.log(`✅ Total table rows created: ${tableRows.length} (1 header + ${results.length} data rows)`);

            // Calculate statistics
            const totalCandidates = results.length;
            const averageScore = results.reduce((sum, r) => sum + parseFloat(r.percentage), 0) / totalCandidates;
            const passCount = results.filter(r => r.status !== 'F').length;  // Count all grades except F
            const passPercentage = ((passCount / totalCandidates) * 100).toFixed(1);
            
            // Find topper - sort by percentage descending and get first
            const sortedByPercentage = [...results].sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
            const topper = sortedByPercentage[0]; // Highest percentage

            // Create document
            const doc = new Document({
                sections: [{
                    properties: {},
                    children: [
                        new Paragraph({
                            text: examTitle,
                            heading: HeadingLevel.HEADING_1,
                            alignment: AlignmentType.CENTER
                        }),
                        new Paragraph({ 
                            text: `Date: ${new Date().toLocaleDateString()}`,
                            spacing: { after: 200 } 
                        }),
                        new Paragraph({ 
                            text: `Total Candidates: ${totalCandidates}`,
                            spacing: { after: 200 } 
                        }),
                        new Paragraph({ 
                            text: `Average Score: ${averageScore.toFixed(2)}%`,
                            spacing: { after: 200 } 
                        }),
                        new Paragraph({ 
                            text: `Pass Percentage: ${passPercentage}%`,
                            spacing: { after: 200 } 
                        }),
                        new Paragraph({ 
                            text: `Topper: ${topper.name} (${topper.percentage}%)`,
                            spacing: { after: 400 } 
                        }),
                        new Table({
                            width: { size: 100, type: "pct" },
                            rows: tableRows,
                            borders: {
                                top: { style: "single", size: 1 },
                                bottom: { style: "single", size: 1 },
                                left: { style: "single", size: 1 },
                                right: { style: "single", size: 1 },
                                insideHorizontal: { style: "single", size: 1 },
                                insideVertical: { style: "single", size: 1 }
                            }
                        })
                    ]
                }]
            });

            console.log('✅ Word document generated successfully');
            return doc;
            
        } catch (error) {
            console.error('❌ Error generating results document:', error);
            throw new Error(`Failed to generate results document: ${error.message}`);
        }
    }
}

module.exports = DocumentParser;