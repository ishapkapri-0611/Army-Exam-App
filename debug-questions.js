// Debug script to check questions loading
const fs = require('fs');
const path = require('path');

console.log('🔍 Debugging questions loading...');

const questionsFilePath = path.join(__dirname, 'invigilatorApp/src/server/data/questions.json');
console.log('📁 Questions file path:', questionsFilePath);

if (fs.existsSync(questionsFilePath)) {
    console.log('✅ Questions file exists');
    
    try {
        const questionsData = fs.readFileSync(questionsFilePath, 'utf8');
        const questions = JSON.parse(questionsData);
        
        console.log(`📋 Loaded ${questions.length} questions:`);
        questions.forEach(q => {
            console.log(`  Q${q.id}: "${q.text.substring(0, 50)}..." - Correct: ${q.correctAnswer}`);
        });
        
        // Test answers
        const testAnswers = [
            { questionId: 0, selectedAnswer: "A" },
            { questionId: 1, selectedAnswer: "A" },
            { questionId: 2, selectedAnswer: "A" },
            { questionId: 3, selectedAnswer: "B" },
            { questionId: 4, selectedAnswer: "B" }
        ];
        
        console.log('\n🧪 Testing calculation:');
        let correctCount = 0;
        testAnswers.forEach(answer => {
            const question = questions.find(q => q.id === answer.questionId);
            const isCorrect = question && question.correctAnswer === answer.selectedAnswer;
            console.log(`  Q${answer.questionId}: Selected=${answer.selectedAnswer}, Correct=${question ? question.correctAnswer : 'NOT FOUND'}, Match=${isCorrect}`);
            if (isCorrect) correctCount++;
        });
        
        console.log(`\n✅ Expected score: ${correctCount}/5 (${(correctCount/5*100).toFixed(2)}%)`);
        
    } catch (error) {
        console.error('❌ Error reading questions file:', error);
    }
} else {
    console.error('❌ Questions file not found');
}