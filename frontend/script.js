// Game data
const categories = [
    "Mad Scientists",
    "Spark Notes",
    "Logo Evolution",
    "Mountains",
    "It Ain't Over"
];

const questions = {
    "Mad Scientists": {
        10: { question: "Who developed the theory of relativity?", answer: "Einstein" },
        20: { question: "Which scientist is known for his laws of motion?", answer: "Newton" },
        30: { question: "Who is considered the father of modern chemistry?", answer: "Lavoisier" },
        40: { question: "Which female scientist discovered radioactivity?", answer: "Marie Curie" },
        50: { question: "Who proposed the heliocentric model of the solar system?", answer: "Copernicus" }
    },
    // Add questions for other categories here
};

let score = 0;

// Generate game board
function generateGameBoard() {
    const gameBoard = document.getElementById('game-board');
    categories.forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category';
        categoryDiv.innerHTML = `<div class="category-title">${category}</div>`;
        
        for (let points = 10; points <= 50; points += 10) {
            const questionCell = document.createElement('div');
            questionCell.className = 'question-cell';
            questionCell.textContent = points;
            questionCell.onclick = () => showQuestion(category, points);
            categoryDiv.appendChild(questionCell);
        }
        
        gameBoard.appendChild(categoryDiv);
    });
}

// Show question in modal
function showQuestion(category, points) {
    const modal = document.getElementById('question-modal');
    const questionText = document.getElementById('question-text');
    const questionData = questions[category][points];
    
    questionText.textContent = `${category} for ${points}: ${questionData.question}`;
    modal.style.display = 'block';
    
    const submitButton = document.getElementById('submit-answer');
    submitButton.onclick = () => checkAnswer(category, points);
}

// Check answer
function checkAnswer(category, points) {
    const answerInput = document.getElementById('answer-input');
    const userAnswer = answerInput.value.trim().toLowerCase();
    const correctAnswer = questions[category][points].answer.toLowerCase();
    
    if (userAnswer === correctAnswer) {
        score += points;
        updateScore();
        alert('Correct!');
    } else {
        alert(`Incorrect. The correct answer is: ${questions[category][points].answer}`);
    }
    
    closeModal();
    disableQuestion(category, points);
}

// Update score
function updateScore() {
    document.getElementById('score').textContent = score;
}

// Close modal
function closeModal() {
    const modal = document.getElementById('question-modal');
    modal.style.display = 'none';
    document.getElementById('answer-input').value = '';
}

// Disable answered question
function disableQuestion(category, points) {
    const categories = document.getElementsByClassName('category');
    for (let categoryDiv of categories) {
        if (categoryDiv.firstChild.textContent === category) {
            const questionCells = categoryDiv.getElementsByClassName('question-cell');
            for (let cell of questionCells) {
                if (parseInt(cell.textContent) === points) {
                    cell.style.backgroundColor = '#ccc';
                    cell.style.cursor = 'default';
                    cell.onclick = null;
                    break;
                }
            }
            break;
        }
    }
}

// Initialize game
generateGameBoard();

// Close modal when clicking outside
window.onclick = (event) => {
    const modal = document.getElementById('question-modal');
    if (event.target == modal) {
        closeModal();
    }
}