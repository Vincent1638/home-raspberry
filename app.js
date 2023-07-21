const { spawn } = require('child_process')
const Automation = require('./Automation')
const AppleHome = require('./AppleHome')
const Device = require('./Device')
const jwt = require('jsonwebtoken')
const express = require('express')
const cookie = require('cookie')
const db = require('./Database')
const WebSocket = require('ws')
const http = require('http')
const app = express()

///////////////////////////////////////////////////////////////////////////////
// Initialize
const server = http.createServer(app)
const wss = new WebSocket.Server({ noServer: true })
const appleHome = new AppleHome('Bridge', '17:51:07:F4:BC:40', '122-33-344')

const weekday = new Intl.DateTimeFormat('en', { weekday: 'short' })
const time = new Intl.DateTimeFormat('en', { timeStyle: 'short', hour12: true })

///////////////////////////////////////////////////////////////////////////////
// Initialize
app.set('view engine', 'pug')
app.use(express.static('public'))
app.use(express.json())

app.use((req, res, next) => {
  req.cookies = cookie.parse(req.headers.cookie || '')
  next()
})

const options = {
  httpOnly: true,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

let customDevices = []
let automations = []
let tuyaDevices = []

let garage = {
  ws: {},
  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  },
}

let switches = {
  ws: {},
  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  },
}

startServer()

///////////////////////////////////////////////////////////////////////////////
// Fine custom devices
const getCustomDevice = deviceId => {
  return customDevices.find(({ id }) => id === deviceId)
}

///////////////////////////////////////////////////////////////////////////////
// Broadcast Json to non-devices.
const broadcast = message => {
  const json = JSON.stringify(message)
  wss.clients.forEach(client => {
    if (client.isUser && client.readyState === WebSocket.OPEN) {
      client.send(json)
    }
  })
}

app.get(['/', '/automations', '/settings'], authenticate, (req, res) => {
  res.render('main', req.user)
})

app.get('/add', async (req, res) => {
  const restart = await findNewDevices()
  res.send(restart ? 'Found new devices' : 'No new devices found')
  if (restart) {
    process.exit(1)
  }
})

app.get('/login', (req, res) => {
  res.render('login', { mode: true })
})

app.post('/login', async (req, res) => {
  const username = req.body.username.toLowerCase()
  const password = req.body.password
  const data = await db.getUserData(username)
  if (data && data.password === password) {
    res.cookie('token', getJWT({ username }), options)
    res.sendStatus(200)
  } else {
    res.sendStatus(401)
  }
})

app.get('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    path: '/',
  })
  res.redirect('/login')
})

///////////////////////////////////////////////////////////////////////////////
// Handle WebSocket connections
wss.on('connection', (ws, req, name) => {
  if (ws.isUser) {
    onClientConnected(ws)
  }
  console.log('Connected:', name)
  ws.on('close', () => console.log('Disconnected:', name))
  ws.on('message', message => handleMessage(ws, message, name))
})

const onClientConnected = async client => {
  const { mode, layout } = await db.getUserData(client.user)
  client.send(JSON.stringify({ event: 'userData', data: { mode, layout } }))
  client.send(JSON.stringify({ event: 'homeData', data: getHomeData() }))
}

///////////////////////////////////////////////////////////////////////////////
// Handle WebSocket upgrades
server.on('upgrade', function upgrade(request, socket, head) {
  const url = new URL(request.url, 'http://test.com')
  const deviceId = url.searchParams.get('id')
  const token = cookie.parse(request.headers.cookie || '').token || url.searchParams.get('token')
  const decodedToken = validateJwt(token)

  if (decodedToken) {
    wss.handleUpgrade(request, socket, head, function done(ws) {
      ws.isUser = true
      ws.user = decodedToken.username
      wss.emit('connection', ws, request, ws.user)
    })
  } else if (deviceId === 'garage') {
    wss.handleUpgrade(request, socket, head, function done(ws) {
      garage.ws = ws
      wss.emit('connection', ws, request, 'Garage')
    })
  } else if (deviceId === 'switches') {
    wss.handleUpgrade(request, socket, head, function done(ws) {
      switches.ws = ws
      wss.emit('connection', ws, request, 'Switches')
    })
  } else {
    const name = deviceId ? deviceId : 'Client'
    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit('connection', ws, request, name)
    })
  }
})

///////////////////////////////////////////////////////////////////////////////
// Handle WebSocket messages
async function handleMessage(ws, message, name) {
  const json = JSON.parse(message)
  console.log(name, json)

  switch (json.event) {
    case 'updateLayout':
      db.updateUserData(ws.user, { layout: json.layout })
      break
    case 'updateMode':
      db.updateUserData(ws.user, { mode: json.mode })
      break
    case 'toggleDevice':
      Device.getDevice(json.id).toggle()
      break
    case 'setDevice':
      Device.getDevice(json.id).command(json)
      break
    case 'toggleSwitch':
      switches.send(json)
      break
    case 'updateSwitch':
      let switchDevice = getCustomDevice(json.id)
      if (switchDevice) {
        switchDevice.state = json.state
        broadcast(switchDevice)
        appleHome.updateAccessory(switchDevice)
      }
      break
    case 'update':
      if (json.id === 'garage') {
        let device = getCustomDevice('garage')
        if (device) {
          device.data = json.text
          device.state = json.state
          broadcast(device)
          appleHome.updateAccessory(device)
        }
      } else if (json.id.includes('sensor')) {
        const sensor = getCustomDevice(json.id)
        sensor.state = json.state
        if (!sensor.state) {
          const date = new Date()
          sensor.data = weekday.format(date) + ' ' + time.format(date)
          db.updateDeviceInfo(sensor.id, { data: sensor.data })
        }
        Automation.check(sensor, { state: sensor.state })
        broadcast(sensor)
        appleHome.updateAccessory(sensor)
      } else if (json.id.includes('door')) {
        let door = getCustomDevice(json.id)
        if (door && door.state !== json.state) {
          Automation.check(door, { state: json.state })
          door.state = json.state
          broadcast(door)
          appleHome.updateAccessory(door)
        }
      }
      break
    case 'setGarage':
      garage.send(json)
      break
    case 'updateGarage':
      let device = getCustomDevice('garage')
      if (device) {
        device.data = json.data
        device.state = json.state
        broadcast(device)
        appleHome.updateAccessory(device)
      }
      break
    case 'updateDoor':
      let door = getCustomDevice(json.id)
      if (door && door.state !== json.state) {
        Automation.check(door, { state: json.state })
        door.state = json.state
        broadcast(door)
        appleHome.updateAccessory(door)
      }
      break
    case 'updateButton':
      Automation.check(getCustomDevice(json.id), { state: true })
      break
    case 'updateSensor':
      const sensor = getCustomDevice(json.id)
      sensor.state = json.state
      if (!sensor.state) {
        const date = new Date()
        sensor.data = weekday.format(date) + ' ' + time.format(date)
        db.updateDeviceInfo(sensor.id, { data: sensor.data })
      }
      Automation.check(sensor, { state: sensor.state })
      broadcast(sensor)
      appleHome.updateAccessory(sensor)
      break
    case 'findDevices':
      findNewDevices().then(found => {
        ws.send(JSON.stringify({ event: 'foundDevices', value: found }))
        if (found) {
          process.exit(1)
        }
      })
      break
    case 'updateAutomations':
      json.removed.forEach(async id => {
        await db.deleteAutomation(id)
      })
      await Promise.all(
        json.automations.map(auto => {
          return db.upsertAutomation(auto)
        })
      )
      process.exit(1)
    case 'updateSettings':
      json.removed.forEach(async id => {
        await updateAutomaitonDevices(id)
        await db.deleteDevice(id)
      })
      await Promise.all(
        json.settings.map(device => {
          return db.upsertDevice(device, false)
        })
      )
      process.exit(1)
  }
}

///////////////////////////////////////////////////////////////////////////////
// Authorize request
async function authenticate(req, res, next) {
  const decodedToken = validateJwt(req.cookies.token)
  if (decodedToken) {
    req.user = await db.getUserData(decodedToken.username)
    next()
  } else {
    const local = 'kenviewDriveLocal'
    req.user = await db.getUserData(local)
    res.cookie('token', getJWT({ username: local }), options)
    next()
  }
}

function validateJwt(token) {
  try {
    return jwt.verify(token, 'process.env.TOKEN_SECRET')
  } catch (e) {
    return null
  }
}

function getJWT(data) {
  return jwt.sign(data, 'process.env.TOKEN_SECRET', { expiresIn: options.maxAge / 1000 })
}

const updateAutomaitonDevices = async id => {
  const updates = []
  automations.forEach(auto => {
    const test = checkSequence(auto.sequence, id)
    if (auto.trigger.device === id || test === 0) {
      updates.push(db.deleteAutomation(auto.id))
    } else if (test === 1) {
      updates.push(db.upsertAutomation(auto))
    }
  })
  return Promise.all(updates)
}

const checkSequence = (sequence, id) => {
  const removeIndexs = []
  let update = false
  sequence.forEach((entry, i) => {
    switch (entry.type) {
      case 'if':
        if (entry.if.device === id) {
          removeIndexs.push(i)
        } else {
          const c = checkSequence(entry.then, id)
          if (c === 0) removeIndexs.push(i)
          else if (c === 1) update = true
        }
        break
      case 'ifElse':
        if (entry.if.device === id) {
          removeIndexs.push(i)
        } else {
          const c1 = checkSequence(entry.then, id)
          const c2 = checkSequence(entry.else, id)
          if (c1 === 0 || c2 === 0) removeIndexs.push(i)
          else if (c1 === 1 || c2 === 1) update = true
        }
        break
      case 'device':
        if (entry.device.includes(id)) {
          if (entry.device.length > 1) {
            const index = entry.device.find(d => d === id)
            entry.device.splice(index, 1)
            update = true
          } else {
            removeIndexs.push(i)
          }
        }
        break
    }
  })
  if (removeIndexs.length > 0) {
    removeIndexs.reverse().forEach(i => sequence.splice(i, 1))
    update = true
  }

  // update: 1, delete: 0, do nothing: -1
  if (update && sequence.length > 0) return 1
  if (sequence.length === 0) return 0
  return -1
}

///////////////////////////////////////////////////////////////////////////////
// Ping WebSocket connections
setInterval(() => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.ping()
    }
  })
}, 30000)

///////////////////////////////////////////////////////////////////////////////
// Send home info
function getHomeData() {
  const deviceData = []
  Device.devices.forEach(({ info }) => {
    deviceData.push(info)
  })
  const states = deviceData.concat(customDevices).map(d => {
    return {
      id: d.id,
      name: d.name,
      type: d.type,
      image: d.image,
      state: d.state,
      brightness: d.brightness,
      data: d.data,
    }
  })
  automations.sort((a, b) => {
    if (a.trigger.type === b.trigger.type) {
      switch (a.trigger.type) {
        case 'device':
          return a.trigger.device < b.trigger.device ? -1 : 1
        case 'time':
          return a.trigger.time < b.trigger.time ? -1 : 1
        default:
          return a.trigger.offset < b.trigger.offset ? -1 : 1
      }
    } else {
      return a.trigger.type < b.trigger.type ? -1 : 1
    }
  })
  return { automations, states, devices: tuyaDevices }
}

///////////////////////////////////////////////////////////////////////////////
// Scan for unregistered devices
function findNewDevices() {
  console.log('Searching for devices')
  return new Promise(resolve => {
    const ls = spawn('tuya-cli', ['wizard', '-s'])
    ls.stdout.on('data', async data => {
      if (data.toString().match(/\(Y\/n\)\s+$/)) {
        ls.stdin.write('y\n')
      }
      if (data.toString().match(/app:\s+$/)) {
        ls.stdin.write('ebf10a3f901dee6435y0ot\n')
      }
      if (data.toString().match(/\[.*]/)) {
        let restart = false
        let deviceIps = []

        const foundDevices = JSON.parse(data.toString())
        const newDevices = foundDevices.filter(d => !tuyaDevices.find(({ id }) => d.id === id))

        if (newDevices.length > 0) {
          console.log('Found new devices, serching for device IPs')
          deviceIps = await Device.findIps(newDevices[0])
          console.log(JSON.stringify(deviceIps))
        }

        const promises = []
        foundDevices.forEach(device => {
          const d = tuyaDevices.find(({ id }) => device.id === id)
          if (d === undefined) {
            const ip = deviceIps[device.id]
            if (ip) {
              console.log('Adding new device:', device.name, deviceIps[device.id])
              promises.push(
                db.upsertDevice(
                  {
                    type: 'outlet',
                    name: [device.name],
                    image: ['outlet'],
                    ip: deviceIps[device.id],
                    key: device.key,
                    id: device.id,
                  },
                  false
                )
              )
              restart = true
            } else {
              console.log('Unable to find IP:', device.name)
            }
          } else if (d.key !== device.key) {
            console.log('Update device key')
            promises.push(db.updateDeviceInfo(device.id, { key: device.key }))
            restart = true
          }
        })

        await Promise.all(promises)
        resolve(restart)
      }
    })
  })
}

///////////////////////////////////////////////////////////////////////////////
// Start server
async function startServer() {
  tuyaDevices = await db.getDevices(false)
  customDevices = await db.getDevices(true)
  automations = await db.getAutomations()

  customDevices.forEach(d => {
    d.name = d.name[0]
    d.image = d.image[0]
    d.state = false
    delete d.custom
  })

  new Automation(automations)
  new Device(tuyaDevices)

  appleHome.addAccessories(Device.devices.map(device => device.info))
  appleHome.addAccessories(customDevices)
  appleHome.onCommand = info => {
    console.log('Received command from Apple:', JSON.stringify(info))
    if (info.type === 'garage') {
      garage.send(info)
    } else if (info.type === 'button') {
      console.log(info)
    } else if (info.type === 'switch') {
      switches.send(info)
    } else {
      Device.getDevice(info.id).command(info)
    }
  }

  Device.devices.forEach(device => {
    device.onData = (info, data) => {
      console.log(info.name, data)
      broadcast(info)
      Automation.check(info, data)
      appleHome.updateAccessory(info)
      console.log(info)
    }
  })

  const port = process.env.PORT || 8080
  server.listen(port, () => {
    console.log(`Server listening at http://192.168.2.90:${port}`)
  })
}
