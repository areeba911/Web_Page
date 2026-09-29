import { useState, useEffect, useCallback, useRef } from 'react';

// Types
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type Difficulty = 'easy' | 'medium' | 'hard';
type GameState = 'idle' | 'playing' | 'paused' | 'gameover';

// Constants
const GRID_SIZE = 20;
const SPEEDS: Record<Difficulty, number> = {
  easy: 180,
  medium: 120,
  hard: 70,
};

const INITIAL_SNAKE: Position[] = [
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 },
];

// Helper functions
function getRandomPosition(snake: Position[]): Position {
  let pos: Position;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (snake.some(seg => seg.x === pos.x && seg.y === pos.y));
  return pos;
}

function getHighScore(difficulty: Difficulty): number {
  const stored = localStorage.getItem(`snake-highscore-${difficulty}`);
  return stored ? parseInt(stored, 10) : 0;
}

function setHighScore(difficulty: Difficulty, score: number): void {
  localStorage.setItem(`snake-highscore-${difficulty}`, score.toString());
}

// Main App Component
export default function App() {
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Position>(() => getRandomPosition(INITIAL_SNAKE));
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [gameState, setGameState] = useState<GameState>('idle');
  const [score, setScore] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [highScore, setHighScoreState] = useState(() => getHighScore('medium'));
  const [scoreAnimation, setScoreAnimation] = useState(false);

  const directionRef = useRef<Direction>('RIGHT');
  const gameStateRef = useRef<GameState>('idle');
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const gameLoopRef = useRef<number | null>(null);

  // Sync refs
  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Update high score when difficulty changes
  useEffect(() => {
    setHighScoreState(getHighScore(difficulty));
  }, [difficulty]);

  // Game loop
  const gameStep = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;

    setSnake(prevSnake => {
      const head = prevSnake[0];
      const dir = directionRef.current;
      let newHead: Position;

      switch (dir) {
        case 'UP':
          newHead = { x: head.x, y: head.y - 1 };
          break;
        case 'DOWN':
          newHead = { x: head.x, y: head.y + 1 };
          break;
        case 'LEFT':
          newHead = { x: head.x - 1, y: head.y };
          break;
        case 'RIGHT':
          newHead = { x: head.x + 1, y: head.y };
          break;
      }

      // Check wall collision
      if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
        setGameState('gameover');
        return prevSnake;
      }

      // Check self collision
      if (prevSnake.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
        setGameState('gameover');
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // Check food collision
      setFood(prevFood => {
        if (newHead.x === prevFood.x && newHead.y === prevFood.y) {
          setScore(prev => {
            const newScore = prev + 10;
            setScoreAnimation(true);
            setTimeout(() => setScoreAnimation(false), 300);
            // Update high score
            if (newScore > getHighScore(difficulty)) {
              setHighScore(difficulty, newScore);
              setHighScoreState(newScore);
            }
            return newScore;
          });
          const nextFood = getRandomPosition(newSnake);
          return nextFood;
        } else {
          newSnake.pop();
          return prevFood;
        }
      });

      return newSnake;
    });
  }, [difficulty]);

  // Start/stop game loop
  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = window.setInterval(gameStep, SPEEDS[difficulty]);
    } else {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    }
    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [gameState, difficulty, gameStep]);

  // Handle direction change
  const changeDirection = useCallback((newDir: Direction) => {
    const opposites: Record<Direction, Direction> = {
      UP: 'DOWN',
      DOWN: 'UP',
      LEFT: 'RIGHT',
      RIGHT: 'LEFT',
    };
    if (opposites[newDir] !== directionRef.current) {
      setDirection(newDir);
    }
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMap: Record<string, Direction> = {
        ArrowUp: 'UP',
        ArrowDown: 'DOWN',
        ArrowLeft: 'LEFT',
        ArrowRight: 'RIGHT',
        w: 'UP',
        s: 'DOWN',
        a: 'LEFT',
        d: 'RIGHT',
        W: 'UP',
        S: 'DOWN',
        A: 'LEFT',
        D: 'RIGHT',
      };

      if (keyMap[e.key]) {
        e.preventDefault();
        if (gameStateRef.current === 'playing') {
          changeDirection(keyMap[e.key]);
        }
      }

      if (e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        if (gameStateRef.current === 'playing') {
          setGameState('paused');
        } else if (gameStateRef.current === 'paused') {
          setGameState('playing');
        } else if (gameStateRef.current === 'idle' || gameStateRef.current === 'gameover') {
          startGame();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeDirection]);

  // Touch controls (swipe)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const minSwipe = 30;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > minSwipe) {
        changeDirection(dx > 0 ? 'RIGHT' : 'LEFT');
      }
    } else {
      if (Math.abs(dy) > minSwipe) {
        changeDirection(dy > 0 ? 'DOWN' : 'UP');
      }
    }
    touchStartRef.current = null;
  }, [changeDirection]);

  // Game controls
  const startGame = useCallback(() => {
    setSnake(INITIAL_SNAKE);
    setFood(getRandomPosition(INITIAL_SNAKE));
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
    setScore(0);
    setGameState('playing');
  }, []);

  const togglePause = useCallback(() => {
    if (gameState === 'playing') {
      setGameState('paused');
    } else if (gameState === 'paused') {
      setGameState('playing');
    }
  }, [gameState]);

  const changeDifficulty = useCallback((newDiff: Difficulty) => {
    setDifficulty(newDiff);
    setHighScoreState(getHighScore(newDiff));
    if (gameState === 'idle' || gameState === 'gameover') {
      setSnake(INITIAL_SNAKE);
      setFood(getRandomPosition(INITIAL_SNAKE));
      setDirection('RIGHT');
      directionRef.current = 'RIGHT';
      setScore(0);
      setGameState('idle');
    }
  }, [gameState]);

  // Render grid cell
  const renderCell = (x: number, y: number) => {
    const isSnakeHead = snake[0].x === x && snake[0].y === y;
    const snakeIndex = snake.findIndex(seg => seg.x === x && seg.y === y);
    const isSnake = snakeIndex !== -1;
    const isFood = food.x === x && food.y === y;

    let cellClass = 'w-full h-full rounded-sm transition-all duration-75 ';

    if (isSnakeHead) {
      cellClass += 'bg-emerald-400 rounded-md shadow-lg shadow-emerald-400/30 animate-snake-appear';
    } else if (isSnake) {
      const opacity = Math.max(0.4, 1 - (snakeIndex / snake.length) * 0.6);
      cellClass += `rounded-sm`;
      return (
        <div
          key={`${x}-${y}`}
          className={cellClass}
          style={{
            backgroundColor: `rgba(52, 211, 153, ${opacity})`,
          }}
        />
      );
    } else if (isFood) {
      cellClass += 'bg-red-400 rounded-full animate-pulse-food shadow-lg shadow-red-400/40';
    } else {
      cellClass += 'bg-gray-800/30';
    }

    return <div key={`${x}-${y}`} className={cellClass} />;
  };

  return (
    <div className="game-container min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-lg mb-4 animate-fade-in">
        <h1 className="text-3xl md:text-4xl font-bold text-center text-white mb-2">
          🐍 Snake Game
        </h1>

        {/* Score Board */}
        <div className="flex justify-between items-center bg-gray-800/60 backdrop-blur rounded-xl px-4 py-3 border border-gray-700/50">
          <div className="text-center">
            <div className="text-xs text-gray-400 uppercase tracking-wide">Score</div>
            <div className={`text-2xl font-bold text-emerald-400 ${scoreAnimation ? 'animate-score-pop' : ''}`}>
              {score}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 uppercase tracking-wide">High Score</div>
            <div className="text-2xl font-bold text-amber-400">
              {highScore}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 uppercase tracking-wide">Length</div>
            <div className="text-2xl font-bold text-blue-400">
              {snake.length}
            </div>
          </div>
        </div>
      </div>

      {/* Game Board */}
      <div
        className="relative bg-gray-900/80 border-2 border-gray-700 rounded-xl overflow-hidden shadow-2xl shadow-black/50"
        style={{
          width: 'min(85vw, 400px)',
          height: 'min(85vw, 400px)',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Grid */}
        <div
          className="grid w-full h-full gap-[1px] p-1"
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
          }}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
            const x = i % GRID_SIZE;
            const y = Math.floor(i / GRID_SIZE);
            return renderCell(x, y);
          })}
        </div>

        {/* Overlay States */}
        {gameState === 'idle' && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
            <div className="text-5xl mb-4">🐍</div>
            <h2 className="text-2xl font-bold text-white mb-2">Ready to Play?</h2>
            <p className="text-gray-300 text-sm mb-4 text-center px-4">
              Use arrow keys, WASD, or swipe to control
            </p>
            <button
              onClick={startGame}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg transition-all hover:scale-105 active:scale-95"
            >
              Start Game
            </button>
          </div>
        )}

        {gameState === 'paused' && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
            <div className="text-5xl mb-4">⏸️</div>
            <h2 className="text-2xl font-bold text-white mb-4">Paused</h2>
            <button
              onClick={togglePause}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-lg transition-all hover:scale-105 active:scale-95"
            >
              Resume
            </button>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
            <div className="text-5xl mb-4">💀</div>
            <h2 className="text-2xl font-bold text-red-400 mb-2">Game Over!</h2>
            <p className="text-white text-lg mb-1">Score: <span className="font-bold text-emerald-400">{score}</span></p>
            {score >= highScore && score > 0 && (
              <p className="text-amber-400 text-sm mb-3 animate-score-pop">🏆 New High Score!</p>
            )}
            <button
              onClick={startGame}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg transition-all hover:scale-105 active:scale-95 mt-2"
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="w-full max-w-lg mt-4 space-y-3 animate-fade-in">
        {/* Action Buttons */}
        <div className="flex gap-2 justify-center">
          {gameState === 'playing' && (
            <button
              onClick={togglePause}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-all active:scale-95"
            >
              ⏸ Pause
            </button>
          )}
          {gameState === 'paused' && (
            <button
              onClick={togglePause}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-all active:scale-95"
            >
              ▶ Resume
            </button>
          )}
          {(gameState === 'playing' || gameState === 'paused') && (
            <button
              onClick={startGame}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-all active:scale-95"
            >
              🔄 Restart
            </button>
          )}
        </div>

        {/* Difficulty Selector */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-gray-400 text-sm">Difficulty:</span>
          {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff) => (
            <button
              key={diff}
              onClick={() => changeDifficulty(diff)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-all active:scale-95 ${
                difficulty === diff
                  ? diff === 'easy'
                    ? 'bg-green-500 text-white'
                    : diff === 'medium'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-red-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {diff.charAt(0).toUpperCase() + diff.slice(1)}
            </button>
          ))}
        </div>

        {/* Touch D-Pad (visible on small screens during gameplay) */}
        {gameState === 'playing' && (
          <div className="md:hidden flex flex-col items-center gap-1 mt-4">
            <button className="touch-btn" onClick={() => changeDirection('UP')}>
              ↑
            </button>
            <div className="flex gap-1">
              <button className="touch-btn" onClick={() => changeDirection('LEFT')}>
                ←
              </button>
              <button className="touch-btn" onClick={() => changeDirection('DOWN')}>
                ↓
              </button>
              <button className="touch-btn" onClick={() => changeDirection('RIGHT')}>
                →
              </button>
            </div>
          </div>
        )}

        {/* Desktop hint */}
        <p className="hidden md:block text-center text-gray-500 text-xs mt-2">
          Arrow keys or WASD to move • Space to pause • Swipe on mobile
        </p>
      </div>
    </div>
  );
}
