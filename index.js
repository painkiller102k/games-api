
const express = require('express')
const app = express()
const port = 8080
const swaggerUi = require('swagger-ui-express')
const yamljs = require('yamljs')
const bcrypt = require('bcryptjs')

const swaggerDocument = yamljs.load('./docs/swagger.yaml')

app.use(express.json())

const users = [
    {
        username: 'user',
        password: bcrypt.hashSync('user123', 10),
        role: 'User'
    },
    {
        username: 'admin',
        password: bcrypt.hashSync('admin123', 10),
        role: 'Admin'
    }
]

const games = [
    { id: 1, name: 'Valorant', price: 0 },
    { id: 2, name: 'Minecraft', price: 20 },
    { id: 3, name: 'GTA 6', price: 90 },
    { id: 4, name: 'GTA 5', price: 10 },
    { id: 5, name: 'Red Dead Redemption 2', price: 30 },
    { id: 6, name: 'Half Life 2', price: 9 },
    { id: 7, name: 'Fortnite', price: 0 }
]

// Authentication
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.set('WWW-Authenticate', 'Basic realm="GamesAPI"')
        return res.status(401).send({
            error: 'Username and password are required'
        })
    }

    const credentials = Buffer
        .from(authHeader.slice(6), 'base64')
        .toString('utf8')

    const separator = credentials.indexOf(':')

    if (separator === -1) {
        res.set('WWW-Authenticate', 'Basic realm="GamesAPI"')
        return res.status(401).send({
            error: 'Invalid credentials'
        })
    }

    const username = credentials.slice(0, separator)
    const password = credentials.slice(separator + 1)

    const user = users.find(user => user.username === username)

    if (!user || !bcrypt.compareSync(password, user.password)) {
        res.set('WWW-Authenticate', 'Basic realm="GamesAPI"')
        return res.status(401).send({
            error: 'Invalid username or password'
        })
    }

    req.user = user
    next()
}

// Admin authorization
function requireAdmin(req, res, next) {
    if (req.user.role !== 'Admin') {
        return res.status(403).send({
            error: 'Admin role is required'
        })
    }

    next()
}

// Get all games
app.get('/games', requireAuth, (req, res) => {
    res.send(games)
})

// Get one game
app.get('/games/:id', requireAuth, (req, res) => {
    const game = games.find(
        game => game.id === Number(req.params.id)
    )

    if (!game) {
        return res.status(404).send({
            error: 'Game not found'
        })
    }

    res.send(game)
})

// Create a game
app.post('/games', requireAuth, (req, res) => {
    if (
        typeof req.body.name !== 'string' ||
        req.body.name.trim() === '' ||
        req.body.price == null ||
        req.body.price === '' ||
        !Number.isFinite(Number(req.body.price)) ||
        Number(req.body.price) < 0
    ) {
        return res.status(400).send({
            error: 'Invalid or missing name or price'
        })
    }

    const name = req.body.name.trim()

    const existingGame = games.find(
        game => game.name.toLowerCase() === name.toLowerCase()
    )

    if (existingGame) {
        return res.status(409).send({
            error: 'Game with this name already exists'
        })
    }

    const game = {
        id: games.length
            ? Math.max(...games.map(game => game.id)) + 1
            : 1,
        name,
        price: Number(req.body.price)
    }

    games.push(game)

    res.status(201)
        .location(`${getBaseUrl(req)}/games/${game.id}`)
        .send(game)
})

// Update a game (Admin only)
app.put('/games/:id', requireAuth, requireAdmin, (req, res) => {
    const game = games.find(
        game => game.id === Number(req.params.id)
    )

    if (!game) {
        return res.status(404).send({
            error: 'Game not found'
        })
    }

    if (
        typeof req.body.name !== 'string' ||
        req.body.name.trim() === '' ||
        req.body.price == null ||
        req.body.price === '' ||
        !Number.isFinite(Number(req.body.price)) ||
        Number(req.body.price) < 0
    ) {
        return res.status(400).send({
            error: 'Invalid or missing name or price'
        })
    }

    const name = req.body.name.trim()

    const existingGame = games.find(
        otherGame =>
            otherGame.id !== game.id &&
            otherGame.name.toLowerCase() === name.toLowerCase()
    )

    if (existingGame) {
        return res.status(409).send({
            error: 'Game with this name already exists'
        })
    }

    game.name = name
    game.price = Number(req.body.price)

    res.status(200).send(game)
})

// Delete a game (Admin only)
app.delete('/games/:id', requireAuth, requireAdmin, (req, res) => {
    const index = games.findIndex(
        game => game.id === Number(req.params.id)
    )

    if (index === -1) {
        return res.status(404).send({
            error: 'Game not found'
        })
    }

    games.splice(index, 1)

    res.status(204).send()
})

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

app.listen(port, () => {
    console.log(`API up at: http://localhost:${port}`)
})

function getBaseUrl(req) {
    return (req.secure ? 'https' : 'http')
        + '://' + req.headers.host
}
