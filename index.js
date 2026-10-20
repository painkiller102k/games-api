
require('dotenv').config()

const express = require('express')
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const swaggerUi = require('swagger-ui-express')
const yamljs = require('yamljs')

const app = express()
const PORT = process.env.PORT || 8080

app.use(express.json())

// Swagger
const swaggerDocument = yamljs.load('./docs/swagger.yaml')

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

// MongoDB models

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['User', 'Admin'],
        required: true
    }
})

const User = mongoose.model('User', userSchema)

const gameSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    }
})

const Game = mongoose.model('Game', gameSchema)

// Basic Authentication

async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.set('WWW-Authenticate', 'Basic realm="GamesAPI"')
        return res.status(401).json({
            error: 'Authentication required'
        })
    }

    try {
        const credentials = Buffer
            .from(authHeader.slice(6), 'base64')
            .toString('utf8')

        const separator = credentials.indexOf(':')

        if (separator < 1) {
            return res.status(401).json({
                error: 'Invalid username or password'
            })
        }

        const username = credentials.slice(0, separator)
        const password = credentials.slice(separator + 1)

        const user = await User.findOne({ username })

        if (!user || !(await bcrypt.compare(password, user.password))) {
            res.set('WWW-Authenticate', 'Basic realm="GamesAPI"')
            return res.status(401).json({
                error: 'Invalid username or password'
            })
        }

        req.user = user
        next()
    } catch (error) {
        next(error)
    }
}

// Admin permissions

function requireAdmin(req, res, next) {
    if (req.user.role !== 'Admin') {
        return res.status(403).json({
            error: 'Admin access required'
        })
    }

    next()
}

// Helper functions

function getBaseUrl(req) {
    const protocol = req.get('x-forwarded-proto') || req.protocol
    return `${protocol}://${req.get('host')}`
}

function isValidGameData(name, price) {
    return (
        typeof name === 'string' &&
        name.trim().length > 0 &&
        typeof price === 'number' &&
        Number.isFinite(price) &&
        price >= 0
    )
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// All /games endpoints require authentication
app.use('/games', authenticate)

// GET /games - User and Admin
app.get('/games', async (req, res, next) => {
    try {
        const games = await Game.find().sort({ id: 1 })
        res.json(games)
    } catch (error) {
        next(error)
    }
})

// GET /games/:id - User and Admin
app.get('/games/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id)

        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({
                error: 'Game ID must be a positive integer'
            })
        }

        const game = await Game.findOne({ id })

        if (!game) {
            return res.status(404).json({
                error: 'Game not found'
            })
        }

        res.json(game)
    } catch (error) {
        next(error)
    }
})

// POST /games - User and Admin
app.post('/games', async (req, res, next) => {
    try {
        const { name, price } = req.body

        if (!isValidGameData(name, price)) {
            return res.status(400).json({
                error: 'Name must be a non-empty string and price must be a non-negative number'
            })
        }

        const cleanName = name.trim()

        const duplicate = await Game.findOne({
            name: {
                $regex: `^${escapeRegex(cleanName)}$`,
                $options: 'i'
            }
        })

        if (duplicate) {
            return res.status(409).json({
                error: 'A game with this name already exists'
            })
        }

        const lastGame = await Game.findOne().sort({ id: -1 })
        const nextId = lastGame ? lastGame.id + 1 : 1

        const game = await Game.create({
            id: nextId,
            name: cleanName,
            price
        })

        res.location(`${getBaseUrl(req)}/games/${game.id}`)
        res.status(201).json(game)
    } catch (error) {
        next(error)
    }
})

// PUT /games/:id - Admin only
app.put('/games/:id', requireAdmin, async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        const { name, price } = req.body

        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({
                error: 'Game ID must be a positive integer'
            })
        }

        if (!isValidGameData(name, price)) {
            return res.status(400).json({
                error: 'Name must be a non-empty string and price must be a non-negative number'
            })
        }

        const game = await Game.findOne({ id })

        if (!game) {
            return res.status(404).json({
                error: 'Game not found'
            })
        }

        const cleanName = name.trim()

        const duplicate = await Game.findOne({
            id: { $ne: id },
            name: {
                $regex: `^${escapeRegex(cleanName)}$`,
                $options: 'i'
            }
        })

        if (duplicate) {
            return res.status(409).json({
                error: 'A game with this name already exists'
            })
        }

        game.name = cleanName
        game.price = price

        await game.save()

        res.json(game)
    } catch (error) {
        next(error)
    }
})

// DELETE /games/:id - Admin only
app.delete('/games/:id', requireAdmin, async (req, res, next) => {
    try {
        const id = Number(req.params.id)

        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({
                error: 'Game ID must be a positive integer'
            })
        }

        const game = await Game.findOneAndDelete({ id })

        if (!game) {
            return res.status(404).json({
                error: 'Game not found'
            })
        }

        res.status(204).send()
    } catch (error) {
        next(error)
    }
})

// Error handler
app.use((error, req, res, next) => {
    console.error(error)

    if (error.code === 11000) {
        return res.status(409).json({
            error: 'A record with this value already exists'
        })
    }

    res.status(500).json({
        error: 'Internal server error'
    })
})

// Create demo users and initial games
async function seedDatabase() {
    const demoUsers = [
        { username: 'user', password: 'user123', role: 'User' },
        { username: 'admin', password: 'admin123', role: 'Admin' }
    ]

    for (const demoUser of demoUsers) {
        const existingUser = await User.findOne({
            username: demoUser.username
        })

        if (!existingUser) {
            const hashedPassword = await bcrypt.hash(
                demoUser.password,
                10
            )

            await User.create({
                username: demoUser.username,
                password: hashedPassword,
                role: demoUser.role
            })
        }
    }

    const gameCount = await Game.countDocuments()

    if (gameCount === 0) {
        await Game.insertMany([
            { id: 1, name: 'Valorant', price: 0 },
            { id: 2, name: 'Minecraft', price: 20 },
            { id: 3, name: 'GTA 6', price: 90 },
            { id: 4, name: 'GTA 5', price: 10 },
            { id: 5, name: 'Red Dead Redemption 2', price: 30 },
            { id: 6, name: 'Half Life 2', price: 9 },
            { id: 7, name: 'Fortnite', price: 0 }
        ])
    }

    console.log('Database seed completed')
}

// Connect to MongoDB and start the API
async function startServer() {
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI is missing from .env')
        process.exit(1)
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI)
        console.log('Connected to MongoDB Atlas')

        await seedDatabase()
        
        app.listen(PORT, () => {
            console.log(`GamesAPI running at http://localhost:${PORT}`)
            console.log(`Swagger UI: http://localhost:${PORT}/docs`)
        })
    } catch (error) {
        console.error('Failed to start API:', error.message)
        process.exit(1)
    }
}

startServer()
