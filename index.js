const express = require('express')
const app = express()
const port = 8080
const swaggerUi = require('swagger-ui-express')
const swaggerDocument = require('./docs/swagger.json')

app.get('/games', (req, res) => {
    res.send(["GTA 6", "Red Dead Redemption 2", "Half-Life 2"]) // lisatud games
})


app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

app.listen(port, () => {
    console.log(`API up at: http://localhost:${port}`)
})