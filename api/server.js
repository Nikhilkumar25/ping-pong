const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = app.listen();
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const waitingPlayers = [];
const activegames = new Map();

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('findgame', (playerName) => {
        console.log(`${playerName} is looking for a game`);
        findgame(socket, playerName);
    });

    socket.on('paddleMove', (data) => {
        const game = activegames.get(socket.id);
        if (game) {
            io.to(game.opponent).emit('opponentPaddleMove', data);
        }
    });

    socket.on('updateBall', (ballData) => {
        const game = activegames.get(socket.id);
        if (game) {
            io.to(game.opponent).emit('ballUpdate', ballData);
        }
    });

    socket.on('updateScore', (scoreData) => {
        const game = activegames.get(socket.id);
        if (game) {
            io.to(game.opponent).emit('scoreUpdate', scoreData);
        }
    });

    socket.on('gameEnd', (winner) => {
        console.log(`${winner} won the game`);
        const game = activegames.get(socket.id);
        if (game) {
            io.to(game.opponent).emit('gameOver', { winner });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
        handleDisconnect(socket);
    });
});

function findgame(socket, playerName) {
    if (waitingPlayers.length > 0) {
        const opponent = waitingPlayers.pop();
        const game = {
            players: [socket.id, opponent.id],
            playerNames: [playerName, opponent.playerName]
        };

        activegames.set(socket.id, { opponent: opponent.id, game });
        activegames.set(opponent.id, { opponent: socket.id, game });

        socket.emit('gameStart', { opponentName: opponent.playerName, isHost: true });
        opponent.socket.emit('gameStart', { opponentName: playerName, isHost: false });
    } else {
        waitingPlayers.push({ id: socket.id, socket, playerName });

        setTimeout(() => {
            const waitingPlayer = waitingPlayers.find(player => player.id === socket.id);
            if (waitingPlayer) {
                socket.emit('noOpponentFound');
            }
        }, 15000); // 15 seconds timeout
    }
}

function handleDisconnect(socket) {
    const index = waitingPlayers.findIndex(player => player.id === socket.id);
    if (index !== -1) {
        waitingPlayers.splice(index, 1);
    }

    const game = activegames.get(socket.id);
    if (game) {
        io.to(game.opponent).emit('opponentLeft');
        activegames.delete(game.opponent);
        activegames.delete(socket.id);
    }
}

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
