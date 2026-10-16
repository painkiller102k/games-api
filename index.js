const express = require('express')
const app = express()
const port = 8080
const swaggerUi = require('swagger-ui-express')
const yamljs = require('yamljs')
const swaggerDocument = yamljs.load('./docs/swagger.yaml')

app.use(express.json())

const games = [
    { id: 1, name: "Valorant", price: 0 },
    { id: 2, name: "Minecraft", price: 20 },
    { id: 3, name: "GTA 6", price: 90 },
    { id: 4, name: "GTA 5", price: 10 },
    { id: 5, name: "Red Dead Redemption 2", price: 30 },
    { id: 6, name: "Half Life 2", price: 9 },
    { id: 7, name: "Fortnite", price: 0 },
]

app.get('/games', (req, res) => {
    res.send(games)
})

app.get('/games/:id', (req, res) => {
    const game = games.find(game => game.id === Number(req.params.id))

    if (!game) {
        return res.status(404).send({ error: "Game not found" })
    }

    res.send(game)
})

app.post('/games', (req, res) => {
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
        name: name,
        price: Number(req.body.price)
    }

    games.push(game)

    res.status(201)
        .location(`${getBaseUrl(req)}/games/${game.id}`)
        .send(game)
})

app.delete('/games/:id', (req, res) => {
    const index = games.findIndex(
        game => game.id === Number(req.params.id)
    )

    if (index === -1) {
        return res.status(404).send({ error: "Game not found" })
    }

    games.splice(index, 1)

    res.status(204).send()
})

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

app.listen(port, () => {
    console.log(`API up at: http://localhost:${port}`)
})

function getBaseUrl(req) {
    return (req.connection && req.connection.encrypted ? 'https' : 'http')
        + '://' + req.headers.host
}