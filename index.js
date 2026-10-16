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
    if (typeof games[req.params.id - 1] === 'undefined') {
        return res.status(404).send({ error: "Game not found" })
    }

    res.send(games[req.params.id - 1])
})

app.post('/games', (req, res) => {
    if (req.body.name == null || req.body.name === '' ||
        req.body.price == null || req.body.price === '') {
        return res.status(400).send({
            error: 'One or all params are missing'
        })
    }

    let game = {
        id: games.length + 1,
        price: req.body.price,
        name: req.body.name
    }

    games.push(game)

    res.status(201)
        .location(`${getBaseUrl(req)}/games/${game.id}`)
        .send(game)
})

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

app.listen(port, () => {
    console.log(`API up at: http://localhost:${port}`)
})

function getBaseUrl(req) {
    return (req.connection && req.connection.encrypted ? 'https' : 'http')
        + '://' + req.headers.host
}