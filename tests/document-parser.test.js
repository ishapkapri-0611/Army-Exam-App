const DocumentParser = require('../shared-lib/utils/document-parser');

describe('DocumentParser', () => {
    let parser;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        parser = new DocumentParser();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('isValidArmyNumber', () => {
        it('should validate old format (2 letters + 6 digits + optional letter)', () => {
            expect(parser.isValidArmyNumber('JC543031A')).toBe(true);
            expect(parser.isValidArmyNumber('AB123456')).toBe(true);
            expect(parser.isValidArmyNumber('XY999999Z')).toBe(true);
        });

        it('should validate new format (digits + letter)', () => {
            expect(parser.isValidArmyNumber('145699Z')).toBe(true);
            expect(parser.isValidArmyNumber('123A')).toBe(true);
            expect(parser.isValidArmyNumber('99999999X')).toBe(true);
        });

        it('should reject invalid formats', () => {
            expect(parser.isValidArmyNumber('')).toBe(false);
            expect(parser.isValidArmyNumber('ABC')).toBe(false);
            expect(parser.isValidArmyNumber('12345')).toBe(false);
            expect(parser.isValidArmyNumber('J543031A')).toBe(false);
            expect(parser.isValidArmyNumber('JC5430')).toBe(false);
        });
    });

    describe('isQuestionLine', () => {
        it('should detect Q1. format', () => {
            expect(parser.isQuestionLine('Q1. What is the answer?')).toBe(true);
            expect(parser.isQuestionLine('Q12. Another question')).toBe(true);
        });

        it('should detect numbered format with dot', () => {
            expect(parser.isQuestionLine('1. What is the capital?')).toBe(true);
            expect(parser.isQuestionLine('25. Another question')).toBe(true);
        });

        it('should detect numbered format with parenthesis', () => {
            expect(parser.isQuestionLine('1) What is democracy?')).toBe(true);
            expect(parser.isQuestionLine('5) Test question')).toBe(true);
        });

        it('should detect Question word format', () => {
            expect(parser.isQuestionLine('Question 1: What is...?')).toBe(true);
            expect(parser.isQuestionLine('Question 10 what is...')).toBe(true);
        });

        it('should not detect option lines as questions', () => {
            expect(parser.isQuestionLine('A. Paris')).toBe(false);
            expect(parser.isQuestionLine('B) London')).toBe(false);
            expect(parser.isQuestionLine('Correct Answer: A')).toBe(false);
        });
    });

    describe('isEnhancedOptionLine', () => {
        it('should detect standard option formats', () => {
            expect(parser.isEnhancedOptionLine('A. Paris')).toBe(true);
            expect(parser.isEnhancedOptionLine('B) London')).toBe(true);
            expect(parser.isEnhancedOptionLine('C: Berlin')).toBe(true);
            expect(parser.isEnhancedOptionLine('D Tokyo')).toBe(true);
        });

        it('should detect True/False options', () => {
            expect(parser.isEnhancedOptionLine('True')).toBe(true);
            expect(parser.isEnhancedOptionLine('False')).toBe(true);
        });

        it('should detect lowercase options', () => {
            expect(parser.isEnhancedOptionLine('a. option one')).toBe(true);
            expect(parser.isEnhancedOptionLine('b) option two')).toBe(true);
        });
    });

    describe('isEnhancedAnswerLine', () => {
        it('should detect Correct Answer format', () => {
            expect(parser.isEnhancedAnswerLine('Correct Answer: A')).toBe(true);
            expect(parser.isEnhancedAnswerLine('Correct Answer: D')).toBe(true);
        });

        it('should detect Answer format', () => {
            expect(parser.isEnhancedAnswerLine('Answer: B')).toBe(true);
        });

        it('should detect Key format', () => {
            expect(parser.isEnhancedAnswerLine('Key: C')).toBe(true);
        });

        it('should detect Solution format', () => {
            expect(parser.isEnhancedAnswerLine('Solution: A')).toBe(true);
        });

        it('should detect Hindi answer format', () => {
            expect(parser.isEnhancedAnswerLine('उत्तर: A')).toBe(true);
        });

        it('should not detect non-answer lines', () => {
            expect(parser.isEnhancedAnswerLine('The answer is obvious')).toBe(false);
            expect(parser.isEnhancedAnswerLine('A. Paris')).toBe(false);
        });
    });

    describe('isExplanationLine', () => {
        it('should detect Explanation format', () => {
            expect(parser.isExplanationLine('Explanation: This is because...')).toBe(true);
        });

        it('should detect Reason format', () => {
            expect(parser.isExplanationLine('Reason: The reason is...')).toBe(true);
        });

        it('should detect Note format', () => {
            expect(parser.isExplanationLine('Note: Remember that...')).toBe(true);
        });

        it('should detect Hint format', () => {
            expect(parser.isExplanationLine('Hint: Think about...')).toBe(true);
        });
    });

    describe('detectDifficulty', () => {
        it('should return hard for analytical questions', () => {
            expect(parser.detectDifficulty('Explain the process of photosynthesis')).toBe('hard');
            expect(parser.detectDifficulty('Analyze the causes of WW2')).toBe('hard');
            expect(parser.detectDifficulty('Compare the two theories')).toBe('hard');
        });

        it('should return medium for factual questions', () => {
            expect(parser.detectDifficulty('What is the capital of France?')).toBe('medium');
            expect(parser.detectDifficulty('Which country is the largest?')).toBe('medium');
            expect(parser.detectDifficulty('Who invented the telephone?')).toBe('medium');
        });

        it('should return easy for other questions', () => {
            expect(parser.detectDifficulty('The sky is blue')).toBe('easy');
            expect(parser.detectDifficulty('Name the color of blood')).toBe('easy');
        });
    });

    describe('detectCategory', () => {
        it('should detect military category', () => {
            expect(parser.detectCategory('The army regiment is stationed at...')).toBe('military');
            expect(parser.detectCategory('Military operations include...')).toBe('military');
            expect(parser.detectCategory('A soldier must...')).toBe('military');
        });

        it('should detect mathematics category', () => {
            expect(parser.detectCategory('Calculate the area of the circle')).toBe('mathematics');
            expect(parser.detectCategory('The number of students is...')).toBe('mathematics');
            expect(parser.detectCategory('In math, the formula...')).toBe('mathematics');
        });

        it('should detect english category', () => {
            expect(parser.detectCategory('The grammar rule states...')).toBe('english');
            expect(parser.detectCategory('In the English language...')).toBe('english');
        });

        it('should detect science category', () => {
            expect(parser.detectCategory('In physics, force equals...')).toBe('science');
            expect(parser.detectCategory('Chemistry deals with atoms')).toBe('science');
            expect(parser.detectCategory('Science is the study of...')).toBe('science');
        });

        it('should return general for unclassified', () => {
            expect(parser.detectCategory('The capital of India is')).toBe('general');
        });
    });

    describe('createEnhancedQuestionFromLine', () => {
        it('should extract question text', () => {
            const result = parser.createEnhancedQuestionFromLine('Q1. What is democracy?', 1);
            expect(result.text).toBe('What is democracy?');
            expect(result.id).toBe(1);
        });

        it('should extract marks from brackets', () => {
            const result = parser.createEnhancedQuestionFromLine('Q1. What is democracy? [2 marks]', 1);
            expect(result.marks).toBe(2);
        });

        it('should extract marks from parentheses', () => {
            const result = parser.createEnhancedQuestionFromLine('1. What is democracy? (3 marks)', 1);
            expect(result.marks).toBe(3);
        });

        it('should default marks to 1 if not specified', () => {
            const result = parser.createEnhancedQuestionFromLine('Q5. Simple question', 5);
            expect(result.marks).toBe(1);
        });

        it('should detect True/False type', () => {
            const result = parser.createEnhancedQuestionFromLine('Q1. The earth is round. True or False', 1);
            expect(result.type).toBe('truefalse');
        });

        it('should detect MCQ type by default', () => {
            const result = parser.createEnhancedQuestionFromLine('Q1. What is the capital?', 1);
            expect(result.type).toBe('mcq');
        });

        it('should detect Hindi language', () => {
            const result = parser.createEnhancedQuestionFromLine('Q1. भारत की राजधानी क्या है?', 1);
            expect(result.language).toBe('hindi');
        });

        it('should detect English language', () => {
            const result = parser.createEnhancedQuestionFromLine('Q1. What is India?', 1);
            expect(result.language).toBe('english');
        });

        it('should initialize empty options array', () => {
            const result = parser.createEnhancedQuestionFromLine('Q1. Test', 1);
            expect(result.options).toEqual([]);
        });
    });

    describe('processEnhancedOptionLine', () => {
        it('should add option to question', () => {
            const question = { options: [] };
            parser.processEnhancedOptionLine(question, 'A. Paris');
            
            expect(question.options.length).toBe(1);
            expect(question.options[0].letter).toBe('A');
            expect(question.options[0].text).toBe('Paris');
        });

        it('should handle True option', () => {
            const question = { options: [] };
            parser.processEnhancedOptionLine(question, 'True');
            
            expect(question.options[0].letter).toBe('A');
            expect(question.options[0].text).toBe('True');
        });

        it('should handle False option', () => {
            const question = { options: [] };
            parser.processEnhancedOptionLine(question, 'False');
            
            expect(question.options[0].letter).toBe('B');
            expect(question.options[0].text).toBe('False');
        });

        it('should remove (Correct) indicator from text', () => {
            const question = { options: [] };
            parser.processEnhancedOptionLine(question, 'A. Paris (Correct)');
            
            expect(question.options[0].text).toBe('Paris');
        });
    });

    describe('processEnhancedAnswerLine', () => {
        it('should set correct answer on question', () => {
            const question = { id: 1, correctAnswer: '', options: [{ letter: 'A', isCorrect: false }] };
            parser.processEnhancedAnswerLine(question, 'Correct Answer: A');
            
            expect(question.correctAnswer).toBe('A');
            expect(question.options[0].isCorrect).toBe(true);
        });

        it('should handle Answer: format', () => {
            const question = { id: 1, correctAnswer: '', options: [{ letter: 'B', isCorrect: false }] };
            parser.processEnhancedAnswerLine(question, 'Answer: B');
            
            expect(question.correctAnswer).toBe('B');
        });
    });

    describe('processExplanationLine', () => {
        it('should add explanation to question', () => {
            const question = {};
            parser.processExplanationLine(question, 'Explanation: Because the earth is round.');
            expect(question.explanation).toBe('Because the earth is round.');
        });

        it('should append to existing explanation', () => {
            const question = { explanation: 'First part.' };
            parser.processExplanationLine(question, 'Note: Additional info.');
            expect(question.explanation).toBe('First part. Additional info.');
        });
    });

    describe('finalizeQuestion', () => {
        it('should add default True/False options when missing', () => {
            const question = { id: 1, type: 'truefalse', options: [], correctAnswer: '' };
            parser.finalizeQuestion(question);
            
            expect(question.options.length).toBe(2);
            expect(question.options[0].text).toBe('True');
            expect(question.options[1].text).toBe('False');
        });

        it('should set totalOptions and parsedAt', () => {
            const question = { 
                id: 1, type: 'mcq', correctAnswer: 'A',
                options: [
                    { letter: 'A', text: 'Option A', isCorrect: true },
                    { letter: 'B', text: 'Option B', isCorrect: false }
                ]
            };
            parser.finalizeQuestion(question);
            
            expect(question.totalOptions).toBe(2);
            expect(question.parsedAt).toBeDefined();
        });

        it('should mark correct option based on correctAnswer', () => {
            const question = { 
                id: 1, type: 'mcq', correctAnswer: 'B',
                options: [
                    { letter: 'A', text: 'Option A' },
                    { letter: 'B', text: 'Option B' }
                ]
            };
            parser.finalizeQuestion(question);
            
            expect(question.options[0].isCorrect).toBe(false);
            expect(question.options[1].isCorrect).toBe(true);
        });
    });

    describe('validateQuestions', () => {
        it('should return valid for well-formed questions', () => {
            const questions = [{
                text: 'What is 2+2?',
                type: 'mcq',
                marks: 1,
                correctAnswer: 'A',
                options: [
                    { letter: 'A', text: '4' },
                    { letter: 'B', text: '5' },
                    { letter: 'C', text: '3' },
                    { letter: 'D', text: '6' }
                ]
            }];
            
            const result = parser.validateQuestions(questions);
            expect(result.isValid).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        it('should report error for empty question text', () => {
            const questions = [{
                text: '',
                type: 'mcq',
                marks: 1,
                correctAnswer: 'A',
                options: [
                    { letter: 'A', text: '4' },
                    { letter: 'B', text: '5' }
                ]
            }];
            
            const result = parser.validateQuestions(questions);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Question 1 has no text');
        });

        it('should report error for less than 2 options', () => {
            const questions = [{
                text: 'Question?',
                type: 'mcq',
                marks: 1,
                correctAnswer: 'A',
                options: [{ letter: 'A', text: 'Only one' }]
            }];
            
            const result = parser.validateQuestions(questions);
            expect(result.isValid).toBe(false);
        });

        it('should report error for invalid marks', () => {
            const questions = [{
                text: 'Question?',
                type: 'mcq',
                marks: 0,
                correctAnswer: 'A',
                options: [
                    { letter: 'A', text: 'A' },
                    { letter: 'B', text: 'B' }
                ]
            }];
            
            const result = parser.validateQuestions(questions);
            expect(result.errors).toContain('Question 1 has invalid marks: 0');
        });

        it('should report error for duplicate options', () => {
            const questions = [{
                text: 'Question?',
                type: 'mcq',
                marks: 1,
                correctAnswer: 'A',
                options: [
                    { letter: 'A', text: 'First' },
                    { letter: 'A', text: 'Duplicate' }
                ]
            }];
            
            const result = parser.validateQuestions(questions);
            expect(result.errors).toContain('Question 1 has duplicate options');
        });

        it('should report correct counts', () => {
            const questions = [
                { text: 'Q1', type: 'mcq', marks: 2, correctAnswer: 'A', options: [{ letter: 'A', text: 'a' }, { letter: 'B', text: 'b' }] },
                { text: 'Q2', type: 'truefalse', marks: 1, correctAnswer: 'A', options: [{ letter: 'A', text: 'True' }, { letter: 'B', text: 'False' }] }
            ];
            
            const result = parser.validateQuestions(questions);
            expect(result.totalQuestions).toBe(2);
            expect(result.totalMarks).toBe(3);
            expect(result.mcqCount).toBe(1);
            expect(result.trueFalseCount).toBe(1);
        });
    });

    describe('calculateResults', () => {
        it('should calculate results for candidates', () => {
            const questions = [
                { id: 1, correctAnswer: 'A', marks: 2 },
                { id: 2, correctAnswer: 'B', marks: 1 },
                { id: 3, correctAnswer: 'C', marks: 1 }
            ];
            const candidates = [
                { armyNumber: 'JC543031A', name: 'John', rank: 'Captain', unit: 'Unit 1' }
            ];
            const answers = [
                { candidateId: 'JC543031A', questionId: 1, selectedAnswer: 'A' },
                { candidateId: 'JC543031A', questionId: 2, selectedAnswer: 'B' },
                { candidateId: 'JC543031A', questionId: 3, selectedAnswer: 'A' }
            ];

            const results = parser.calculateResults(answers, questions, candidates);
            
            expect(results.length).toBe(1);
            expect(results[0].armyNumber).toBe('JC543031A');
            expect(results[0].totalScore).toBe(3); // Q1 (2) + Q2 (1) correct
            expect(results[0].maxMarks).toBe(4);
            expect(results[0].correctAnswers).toBe(2);
            expect(results[0].questionsAttempted).toBe(3);
        });

        it('should sort results by percentage descending', () => {
            const questions = [
                { id: 1, correctAnswer: 'A', marks: 1 },
                { id: 2, correctAnswer: 'B', marks: 1 }
            ];
            const candidates = [
                { armyNumber: 'JC543031A', name: 'Low', rank: 'Private', unit: 'U1' },
                { armyNumber: '145699Z', name: 'High', rank: 'Captain', unit: 'U2' }
            ];
            const answers = [
                { candidateId: 'JC543031A', questionId: 1, selectedAnswer: 'C' },
                { candidateId: '145699Z', questionId: 1, selectedAnswer: 'A' },
                { candidateId: '145699Z', questionId: 2, selectedAnswer: 'B' }
            ];

            const results = parser.calculateResults(answers, questions, candidates);
            expect(parseFloat(results[0].percentage)).toBeGreaterThan(parseFloat(results[1].percentage));
        });

        it('should assign correct grades based on percentage', () => {
            const questions = [
                { id: 1, correctAnswer: 'A', marks: 1 },
                { id: 2, correctAnswer: 'A', marks: 1 },
                { id: 3, correctAnswer: 'A', marks: 1 },
                { id: 4, correctAnswer: 'A', marks: 1 },
                { id: 5, correctAnswer: 'A', marks: 1 }
            ];
            const candidates = [
                { armyNumber: '100A', name: 'Full', rank: 'R', unit: 'U' }
            ];
            const answers = [
                { candidateId: '100A', questionId: 1, selectedAnswer: 'A' },
                { candidateId: '100A', questionId: 2, selectedAnswer: 'A' },
                { candidateId: '100A', questionId: 3, selectedAnswer: 'A' },
                { candidateId: '100A', questionId: 4, selectedAnswer: 'A' },
                { candidateId: '100A', questionId: 5, selectedAnswer: 'A' }
            ];

            const results = parser.calculateResults(answers, questions, candidates);
            expect(results[0].status).toBe('D'); // 100% => grade D (80+)
        });

        it('should handle candidates with no answers', () => {
            const questions = [{ id: 1, correctAnswer: 'A', marks: 1 }];
            const candidates = [{ armyNumber: '100A', name: 'No answers', rank: 'R', unit: 'U' }];
            const answers = [];

            const results = parser.calculateResults(answers, questions, candidates);
            expect(results[0].totalScore).toBe(0);
            expect(results[0].questionsAttempted).toBe(0);
            expect(results[0].accuracy).toBe('0.00');
        });
    });

    describe('parseUsersDocument', () => {
        it('should throw for empty buffer', async () => {
            await expect(parser.parseUsersDocument(null)).rejects.toThrow('Failed to parse users document');
            await expect(parser.parseUsersDocument(Buffer.alloc(0))).rejects.toThrow('Failed to parse users document');
        });
    });

    describe('parseQuestionsDocument', () => {
        it('should throw for empty buffer', async () => {
            await expect(parser.parseQuestionsDocument(null)).rejects.toThrow('Failed to parse questions document');
            await expect(parser.parseQuestionsDocument(Buffer.alloc(0))).rejects.toThrow('Failed to parse questions document');
        });
    });
});
