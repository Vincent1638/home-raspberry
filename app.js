const credentials = require('./data/credentials.json')
const { spawn } = require('child_process')
const Automation = require('./Automation')
const Database = require('./Database')
const Device = require('./Device')
const express = require('express')
const WebSocket = require('ws')
const http = require('http')
const app = express()

///////////////////////////////////////////////////////////////////////////////
// Initialize 
const server = http.createServer(app)
const wss = new WebSocket.Server({ noServer: true })
const db = new Database('postgres://cymbunpcicyvez:52277196426faf6926a833537195648e3367fff54fc727a020b88d0fb85013db@ec2-52-86-223-172.compute-1.amazonaws.com:5432/d2imj1uvkhavnv')

const weekday = new Intl.DateTimeFormat('en', { weekday: 'short' })
const time = new Intl.DateTimeFormat('en', { timeStyle: 'short', hour12: true })

let customDevices = []
let sensorTimeout = {}
let automations = []
let tuyaDevices = []
let heroku = {}
let garage = {}

startServer()

///////////////////////////////////////////////////////////////////////////////
// Fine custom devices
function getCustomDevice(deviceId) {
    return customDevices.find(({ id }) => id === deviceId)
}

///////////////////////////////////////////////////////////////////////////////
// Broadcast Json to heroku.
function broadcast(message) {
    if (heroku.readyState === WebSocket.OPEN) {
        heroku.send(JSON.stringify(message))
    }
}

///////////////////////////////////////////////////////////////////////////////
// Handle WebSocket connections
wss.on('connection', (ws, req, name) => {
    console.log('Connected:', name)
    ws.on('close', () => console.log('Disconnected:', name))
    ws.on('message', (message) => handleMessage(ws, message, name))
})

function startHerokuConnection() {
    heroku = new WebSocket('wss://home100.herokuapp.com?token=' + credentials.token)
    heroku.on('open', () => { heroku.send(getHerokuData()); console.log('Connected: Heroku') })
    heroku.on('message', data => handleMessage(heroku, data, 'Heroku'))
    heroku.on('close', () => setTimeout(startHerokuConnection, 5000))
    heroku.on('error', e => console.log(e))
}

///////////////////////////////////////////////////////////////////////////////
// Handle WebSocket upgrades
server.on('upgrade', function upgrade(request, socket, head) {
    const url = new URL(request.url, 'http://test.com')
    const deviceId = url.searchParams.get('id')
    if (deviceId === 'garage') {
        wss.handleUpgrade(request, socket, head, function done(ws) {
            garage = ws
            wss.emit('connection', ws, request, 'Garage')
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
function handleMessage(ws, message, name) {
    const json = JSON.parse(message)
    console.log(name, json)
    switch (json.event) {
        case 'toggleDevice':
            Device.getDevice(json.id).toggle()
            break
        case 'setDevice':
            Device.getDevice(json.id).command(json)
            break
        case 'setGarage':
            if (garage.readyState === WebSocket.OPEN) {
                garage.send(JSON.stringify(json))
            }
            break
        case 'updateGarage':
            let device = getCustomDevice('garage')
            if (device) {
                device.data = json.state
                device.state = !(json.state === 'Closed')
                broadcast(device)
            }
            break
        case 'updateDoor':
            let door = getCustomDevice(json.id)
            if (door && door.state !== json.state) {
                Automation.check(door, { state: json.state })
                door.state = json.state
                broadcast(door)
            }
            break
        case 'updateButton':
            Automation.check(getCustomDevice(json.id), { state: true })
            break
        case 'updateSensor':
            const sensor = getCustomDevice(json.id)
            if (json.state) {
                Automation.check(sensor, { state: true })
            } else {
                const date = new Date
                sensor.data = weekday.format(date) + ' ' + time.format(date)
                db.updateDeviceData(sensor.id, sensor.data)
                clearTimeout(sensorTimeout[sensor.id])
                sensorTimeout[sensor.id] = setTimeout(() => {
                    console.log(sensor.name, { state: false })
                    Automation.check(sensor, { state: false })
                }, 60000)
            }
            broadcast({ type: 'sensor', id: json.id, state: json.state, data: sensor.data })
            break
        case 'findDevices':
            findNewDevices().then(found => {
                ws.send(JSON.stringify({ event: 'foundDevices', value: found }))
                if (found) { process.exit(1) }
            })
            break
        case 'updateAutomations':
            json.removed.forEach(id => {
                db.deleteRow('automations', id)
            })
            Promise.all(json.automations.map(auto => {
                return db.upsertAutomation(auto)
            })).then(() => process.exit(1))
            break
        case 'updateSettings':
            json.removed.forEach(id => {
                db.deleteRow('settings', id)
            })
            Promise.all(json.settings.map(device => {
                return db.upsertDevice(device, false)
            })).then(() => process.exit(1))
            break
        case 'getUserData':
            db.getUserData(json.username)
                .then(data => broadcast({ event: 'userData', resId: json.resId, data }))
            break
        case 'updateLayout':
            db.updateUserLayout(json.user, json.layout)
            break
        case 'updateMode':
            db.updateUserMode(json.user, json.mode)
            break
    }
}

///////////////////////////////////////////////////////////////////////////////
// Ping WebSocket connections
setInterval(() => {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.ping()
        }
    })
    if (heroku.readyState === WebSocket.OPEN) {
        heroku.ping()
    }
}, 30000)


///////////////////////////////////////////////////////////////////////////////
// Send device info to Heroku
function getHerokuData() {
    const deviceData = []
    Device.devices.forEach(({ info }) => {
        deviceData.push(info)
    })
    return JSON.stringify({
        event: 'homeData',
        data: {
            automations,
            devices: tuyaDevices,
            states: deviceData.concat(customDevices),

        }
    })
}

///////////////////////////////////////////////////////////////////////////////
// Scan for unregistered devices
function findNewDevices() {
    return new Promise((resolve) => {
        const ls = spawn('tuya-cli', ['wizard', '-s'])
        ls.stdout.on('data', async (data) => {
            if (data.toString().match(/\(Y\/n\)\s+$/)) {
                ls.stdin.write('y\n')
            }
            if (data.toString().match(/app:\s+$/)) {
                ls.stdin.write('ebf10a3f901dee6435y0ot\n')
            }
            if (data.toString().match(/\[.*]/)) {
                const foundDevices = JSON.parse(data.toString())
                let newDevices = foundDevices.filter(device => !tuyaDevices.find(({ id }) => device.id === id))
                if (newDevices.length > 0) {
                    let foundDevices = false
                    let ips = await Device.findIps(newDevices[0])
                    await Promise.all(newDevices.map(device => {
                        console.log('Found device:', JSON.stringify(device))
                        if (ips[device.id]) {
                            foundDevices = true
                            return db.upsertDevice({
                                type: 'outlet', name: device.name, image: 'outlet',
                                ip: ips[device.id], key: device.key, id: device.id
                            }, false)
                        }
                    }))
                    resolve(foundDevices)
                } else {
                    resolve(false)
                }
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
    })

    new Automation(automations)
    new Device(tuyaDevices)

    Device.devices.forEach(device => {
        device.onData = (info, data) => {
            console.log(info.name, data)
            broadcast(info)
            Automation.check(info, data)
        }
    })

    const port = process.env.PORT || 8080
    server.listen(port, () => {
        console.log(`Server listening at http://192.168.2.90:${port}`)
    })
    startHerokuConnection()
}
