// Test calculation manually
const fs = require('fs');
const path = require('path');

console.log('🧪 Manual Calculation Test');

// Load questions
const questionsPath = path.join(__dirname, 'invigilatorApp/src/server/data/questions.json');
const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

// Load answers
const answersPath = path.join(__dirname, 'invigilatorApp/results/all_answers.json');
const allAnswers = JSON.parse(fs.readFileSync(answersPath, 'utf8'));

// Filter answers for JC543031A
const candidateAnswers = allAnswers.filter(a => a.candidateId === 'JC543031A');

console.log('\n📋 Questions:');
questions.forEach(q => {
    console.log(`Q${q.id}: ${q.text.substring(0, 40)}... → Correct: ${q.correctAnswer}`);
});

console.log('\n📝 Candidate JC543031A Answers:');
candidateAnswers.forEach(a => {
    console.log(`Q${a.questionId}: Selected ${a.selectedAnswer} at ${a.timestamp}`);
});

console.log('\n🔍 Calculation:');
let correctCount = 0;
candidateAnswers.forEach(answer => {
    const question = questions.find(q => q.id === answer.questionId);
    if (question) {
        const isCorrect = question.correctAnswer === answer.selectedAnswer;
        console.log(`Q${answer.questionId}: Selected=${answer.selectedAnswer}, Correct=${question.correctAnswer}, Match=${isCorrect ? '✅' : '❌'}`);
        if (isCorrect) correctCount++;
    } else {
        console.log(`Q${answer.questionId}: Question not found!`);
    }
});

const percentage = (correctCount / questions.length * 100).toFixed(2);
console.log(`\n🎯 Final Score: ${correctCount}/${questions.length} (${percentage}%)`);

// Check for duplicate answers (different timestamps)
console.log('\n🔍 Checking for duplicate answers:');
const answersByQuestion = {};
candidateAnswers.forEach(answer => {
    if (!answersByQuestion[answer.questionId]) {
        answersByQuestion[answer.questionId] = [];
    }
    answersByQuestion[answer.questionId].push(answer);
});

Object.keys(answersByQuestion).forEach(qId => {
    const answers = answersByQuestion[qId];
    if (answers.length > 1) {
        console.log(`⚠️ Q${qId} has ${answers.length} answers:`);
        answers.forEach((a, i) => {
            console.log(`  ${i+1}. ${a.selectedAnswer} at ${a.timestamp}`);
        });
    }
});