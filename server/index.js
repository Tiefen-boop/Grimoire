require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')

const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/users')
const characterRoutes = require('./routes/characters')
const campaignRoutes = require('./routes/campaigns')

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/characters', characterRoutes)
app.use('/api/campaigns', campaignRoutes)

// Serve built React app in production
const clientDist = path.join(__dirname, '../client/dist')
app.use(express.static(clientDist))
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Grimoire running on http://0.0.0.0:${PORT}`)
})
