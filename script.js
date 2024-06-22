const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const urlParams = new URLSearchParams(window.location.search);
const debug = urlParams.has('debug');

const shipImg = new Image();
shipImg.src = 'rocket.png';

let ship = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    width: 100,
    height: 100,
    speed: 0.2,
    targetX: canvas.width / 2,
    targetY: canvas.height / 2,
    shield: false,
    rockets: 0,
    maxRockets: 3,
    shieldRemaining: 0,
    shieldDuration: 20000, // 20 seconds
    shieldTimeout: null
};

let obstacles = [];
let pickups = [];
let rockets = [];
let score = 0;
let highScore = localStorage.getItem('highScore') || 0;
let gameOver = false;
let spawnRate = 2000;
let maxSpawnRate = 500;
let lastSpawnTime = 0;
let pause = false;
let countdown = 3;
let countdownInterval;
let isCountingDown = false;
let gameRunning = true;
let mouseInsideCanvas = false;
let gameStartTime = Date.now();
let obstacleInterval;
let pickupInterval;
let blinkShield = false;

document.addEventListener('mousemove', moveShip);
document.addEventListener('click', shootRocket);
document.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mouseleave', pauseGame);
canvas.addEventListener('mouseenter', handleResume);

function startGame() {
    ship = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        width: 100,
        height: 100,
        speed: 0.2,
        targetX: canvas.width / 2,
        targetY: canvas.height / 2,
        shield: false,
        rockets: 0,
        maxRockets: 3,
        shieldRemaining: 0,
        shieldDuration: 20000, // 20 seconds
        shieldTimeout: null
    };
    obstacles = [];
    pickups = [];
    rockets = [];
    score = 0;
    spawnRate = 2000;
    gameOver = false;
    pause = false;
    blinkShield = false;
    document.body.classList.remove('paused-cursor');
    updateRocketCount();
    updateScore();
    gameStartTime = Date.now();
    adjustObstacleSpawnRate();
    clearInterval(pickupInterval);
    pickupInterval = setInterval(createPickup, Math.random() * 10000 + 5000); // Random interval between 5-15 seconds
    loop();
}

function moveShip(e) {
    ship.targetX = e.clientX - ship.width / 2;
    ship.targetY = e.clientY - ship.height / 2;
}

function shootRocket() {
    if (ship.rockets > 0) {
        ship.rockets--;
        fireRocket();
        updateRocketCount();
    }
}

function fireRocket() {
    rockets.push({
        x: ship.x + ship.width,
        y: ship.y + ship.height / 2,
        radius: 10,
        speed: 8,
        exploding: false,
        explodeRadius: 50
    });
}

function pauseGame() {
    if (!gameOver && !pause) {
        pause = true;
        isCountingDown = false;
        countdown = 3;
        document.body.classList.add('paused-cursor'); // Show cursor
    }
}

function handleResume() {
    if (pause && !isCountingDown) {
        countdown = 3;
        isCountingDown = true;
        countdownInterval = setInterval(() => {
            if (isMouseOverShip()) {
                countdown--;
                if (countdown === 0) {
                    clearInterval(countdownInterval);
                    isCountingDown = false;
                    pause = false;
                    document.body.classList.remove('paused-cursor'); // Hide cursor
                }
            } else {
                countdown = 3;
            }
        }, 1000);
    }
}

function isMouseOverShip() {
    const rect = canvas.getBoundingClientRect();
    const mouseX = ship.targetX + ship.width / 2 - rect.left;
    const mouseY = ship.targetY + ship.height / 2 - rect.top;
    return (
        mouseX > ship.x && mouseX < ship.x + ship.width &&
        mouseY > ship.y && mouseY < ship.y + ship.height
    );
}

function update() {
    if (!pause && !gameOver) {
        const distX = ship.targetX - ship.x;
        const distY = ship.targetY - ship.y;
        ship.x += distX * ship.speed;
        ship.y += distY * ship.speed;

        if (ship.shield) {
            if (ship.shieldRemaining <= 0) {
                ship.shield = false;
                ship.shieldRemaining = 0;
                clearTimeout(ship.shieldTimeout);
            } else if (ship.shieldRemaining <= 3000) {
                blinkShield = !blinkShield;
            }
        }

        if (Date.now() - lastSpawnTime > spawnRate) {
            createObstacle();
            lastSpawnTime = Date.now();
            spawnRate = Math.max(spawnRate - 10, maxSpawnRate);
        }

        moveObstacles();
        movePickups();
        moveRockets();
        checkCollisions();
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawShip();
    drawObstacles();
    drawPickups();
    drawRockets();
    drawScore();
    drawShieldBar();
    if (debug) drawDebugInfo();

    if (pause) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.fillText('Game Paused', canvas.width / 2 - 50, canvas.height / 2 - 30);
        ctx.fillText('Hover over the ship for 3 seconds to resume', canvas.width / 2 - 150, canvas.height / 2);
        if (isCountingDown) {
            ctx.fillText(`Resuming in: ${countdown}`, canvas.width / 2 - 50, canvas.height / 2 + 30);
        }
    }

    if (gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.fillText('Game Over', canvas.width / 2 - 50, canvas.height / 2 - 30);
        ctx.fillText(`Your score: ${score}`, canvas.width / 2 - 50, canvas.height / 2);
        ctx.fillText(`High score: ${highScore}`, canvas.width / 2 - 50, canvas.height / 2 + 30);
        ctx.fillText('Click to Restart', canvas.width / 2 - 50, canvas.height / 2 + 60);
    }
}

function loop() {
    update();
    draw();
    if (!gameOver) {
        requestAnimationFrame(loop);
    }
}

function checkCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

function createObstacle() {
    if (pause) return; // Do not adjust spawn rate if the game is paused
    const size = Math.random() * 40 + 20; // Random size between 20 and 60
    const speed = Math.random() * 3 + 3;  // Random speed between 3 and 6
    const angleVariation = score >= 100 ? Math.random() * 0.2 - 0.1 : 0; // Upward or downward angle variation
    const upwardAngle = Math.random() < 0.5 ? -1 : 1; // Upward or downward direction
    const isRed = Math.random() < 0.1; // 10% chance for a red obstacle
    const shape = Math.random() < 0.5 ? 'round' : 'square';

    const obstacle = {
        x: canvas.width,
        y: Math.random() * (canvas.height - size),
        width: size,
        height: size,
        speed: isRed ? speed * 2 : speed,
        color: isRed ? 'red' : 'gray',
        angle: angleVariation * upwardAngle,
        shape: shape
    };
    obstacles.push(obstacle);
    adjustObstacleSpawnRate();
}

function moveObstacles() {
    obstacles.forEach((obstacle, index) => {
        obstacle.x -= obstacle.speed;
        obstacle.y += obstacle.angle * obstacle.speed;

        if (obstacle.y <= 0 || obstacle.y + obstacle.height >= canvas.height) {
            obstacle.angle *= -1;
        }

        if (obstacle.x + obstacle.width < 0) {
            obstacles.splice(index, 1);
            score++;
            updateScore();
        }
    });
}

function createPickup() {
    const size = 30;
    const pickupType = Math.random();
    let color, ability;

    if (pickupType < 0.3) { // 30% chance for shield pickup
        color = 'blue';
        ability = 'shield';
    } else if (pickupType < 0.6) { // 30% chance for rocket pickup
        color = 'yellow';
        ability = 'rocket';
    } else {
        return; // 40% chance for no pickup
    }

    const pickup = {
        x: canvas.width,
        y: Math.random() * (canvas.height - size),
        width: size,
        height: size,
        color: color,
        ability: ability
    };
    pickups.push(pickup);
}

function movePickups() {
    pickups.forEach((pickup, index) => {
        pickup.x -= 5;
        if (pickup.x + pickup.width < 0) {
            pickups.splice(index, 1);
        }
    });
}

function moveRockets() {
    rockets.forEach((rocket, rIndex) => {
        rocket.x += rocket.speed;
    });
}

function explodeRocket(x, y) {
    console.log("explode rocket",obstacles)
    obstacles = obstacles.filter((obstacle, oIndex) => {
        if (Math.sqrt((obstacle.x - x) ** 2 + (obstacle.y - y) ** 2) < 50) {
            score++;
            return false;
        }
        return true;
    });
    console.log("explode rocket after",obstacles)
    updateScore();
}

function checkCollisions() {
    obstacles.forEach((obstacle, oIndex) => {
        if (
            ship.x < obstacle.x + obstacle.width &&
            ship.x + ship.width > obstacle.x &&
            ship.y < obstacle.y + obstacle.height &&
            ship.y + ship.height > obstacle.y
        ) {
            if (obstacle.color === 'red' || !ship.shield) {
                endGame();
            } else if (ship.shield && obstacle.color === 'gray') {
                ship.shield = false;
                clearTimeout(ship.shieldTimeout);
                obstacles.splice(oIndex, 1); // Remove the obstacle
            }
        }

        rockets.forEach((rocket, rIndex) => {
            const distance = Math.sqrt((obstacle.x - rocket.x) ** 2 + (obstacle.y - rocket.y) ** 2);
            if (distance < 50) {
                rocket.exploding = true;
                rockets.splice(rIndex, 1);
                explodeRocket(rocket.x, rocket.y);
            }
        });
    });

    pickups.forEach((pickup, index) => {
        if (
            ship.x < pickup.x + pickup.width &&
            ship.x + ship.width > pickup.x &&
            ship.y < pickup.y + pickup.height &&
            ship.y + ship.height > pickup.y
        ) {
            activatePickup(pickup.ability);
            pickups.splice(index, 1);
        }
    });
}

function activatePickup(ability) {
    switch (ability) {
        case 'shield':
            activateShield();
            break;
        case 'rocket':
            if (ship.rockets < ship.maxRockets) {
                ship.rockets++;
            }
            break;
        default:
            break;
    }
}

function activateShield() {
    ship.shield = true;
    ship.shieldRemaining = ship.shieldDuration;
    clearTimeout(ship.shieldTimeout);
    ship.shieldTimeout = setTimeout(() => {
        ship.shield = false;
        ship.shieldRemaining = 0;
    }, ship.shieldDuration); // 20 seconds
    updateShieldBar(); // Ensure the shield bar starts updating
}

function updateShieldBar() {
    if (ship.shield) {
        const updateInterval = setInterval(() => {
            if (ship.shieldRemaining > 0) {
                ship.shieldRemaining -= 100;
            } else {
                clearInterval(updateInterval);
                ship.shield = false;
                ship.shieldRemaining = 0;
            }
        }, 100);
    }
}

function drawShip() {
    ctx.drawImage(shipImg, ship.x, ship.y, ship.width, ship.height);
    if (ship.shield) {
        if (!blinkShield || ship.shieldRemaining > 3000 || Math.floor(ship.shieldRemaining / 100) % 2 === 0) {
            ctx.beginPath();
            ctx.arc(ship.x + ship.width / 2, ship.y + ship.height / 2, ship.width / 2 + 10, 0, Math.PI * 2);
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }
}

function drawObstacles() {
    obstacles.forEach(obstacle => {
        ctx.fillStyle = obstacle.color;
        if (obstacle.shape === 'round') {
            ctx.beginPath();
            ctx.arc(obstacle.x, obstacle.y, obstacle.width / 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        }
    });
}

function drawPickups() {
    pickups.forEach(pickup => {
        ctx.fillStyle = pickup.color;
        ctx.fillRect(pickup.x, pickup.y, pickup.width, pickup.height);
    });
}

function drawRockets() {
    rockets.forEach(rocket => {
        ctx.beginPath();
        ctx.arc(rocket.x, rocket.y, rocket.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'yellow';
        ctx.fill();
        ctx.closePath();
    });

    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText(`Rockets: ${ship.rockets}/${ship.maxRockets}`, 10, 30);
}

function drawScore() {
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText(`Score: ${score}`, canvas.width - 100, 30);
}

function drawShieldBar() {
    if (ship.shield) {
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 60, 100, 20); // Outline of the shield bar
        ctx.fillStyle = 'blue';
        ctx.fillRect(10, 60, (ship.shieldRemaining / ship.shieldDuration) * 100, 20); // Fill of the shield bar
    }
}

function drawDebugInfo() {
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.fillText(`Obstacles: ${obstacles.length}`, canvas.width - 150, canvas.height - 30);
}

function gameOverScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillText('Game Over', canvas.width / 2 - 50, canvas.height / 2 - 30);
    ctx.fillText(`Your score: ${score}`, canvas.width / 2 - 50, canvas.height / 2);
    ctx.fillText(`High score: ${highScore}`, canvas.width / 2 - 50, canvas.height / 2 + 30);
    ctx.fillText('Click to Restart', canvas.width / 2 - 50, canvas.height / 2 + 60);
}

function endGame() {
    gameOver = true;
    document.body.classList.add('paused-cursor'); // Show cursor
    canvas.addEventListener('click', startGame, { once: true });
}

function updateScore() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', highScore);
    }
}

function updateRocketCount() {
    // This function can be customized to visually show the rocket count
}

function adjustObstacleSpawnRate() {
    const maxSpawnRate = 500; // Max spawn rate in milliseconds
    const timeElapsed = Math.min(Date.now() - gameStartTime, 120000); // Cap at 2 minutes
    const spawnInterval = 2000 - (1500 * (timeElapsed / 120000)); // Start at 2000ms and decrease to 500ms
    clearInterval(obstacleInterval);
    obstacleInterval = setInterval(createObstacle, spawnInterval);
}

startGame();
