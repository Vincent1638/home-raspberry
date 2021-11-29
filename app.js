const credentials = require('./data/credentials.json')
const { spawn } = require('child_process')
const Automation = require('./Automation')
const AppleHome = require('./AppleHome')
const Database = require('./Database')
const { getUserDataTest } = require('./Firestore')
const Device = require('./Device')
const express = require('express')
const WebSocket = require('ws')
const http = require('http')
const app = express()

///////////////////////////////////////////////////////////////////////////////
// Initialize 
const server = http.createServer(app)
const wss = new WebSocket.Server({ noServer: true })
const db = new Database({ connectionString: credentials.postgres, ssl: { rejectUnauthorized: false } })
const appleHome = new AppleHome('Bridge', '17:51:07:F4:BC:AE', '111-22-333')

const weekday = new Intl.DateTimeFormat('en', { weekday: 'short' })
const time = new Intl.DateTimeFormat('en', { timeStyle: 'short', hour12: true })

let customDevices = []
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

app.get('/add', async (req, res) => {
    const restart = await findNewDevices()
    res.send(restart ? 'Found new devices' : 'No new devices found')
    if (restart) { process.exit(1) }
})

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
                const date = new Date
                sensor.data = weekday.format(date) + ' ' + time.format(date)
                db.updateDeviceData(sensor.id, sensor.data)
            }
            Automation.check(sensor, { state: sensor.state })
            broadcast(sensor)
            appleHome.updateAccessory(sensor)
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
                db.deleteRow('devices', id)
            })
            Promise.all(json.settings.map(device => {
                return db.upsertDevice(device, false)
            })).then(() => process.exit(1))
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
    return JSON.stringify({
        event: 'homeData',
        data: { automations, states, devices: tuyaDevices }
    })
}

///////////////////////////////////////////////////////////////////////////////
// Scan for unregistered devices
function findNewDevices() {
    console.log('Searching for devices')
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
                let restart = false
                let deviceIps = []

                const foundDevices = JSON.parse(data.toString())
                const newDevices = foundDevices.filter(d => !tuyaDevices.find(({ id }) => d.id === id))

                if (newDevices.length > 0) {
                    console.log('Found new devices, serching for device IPs')
                    deviceIps = await Device.findIps(newDevices[0])
                }

                const promises = []
                foundDevices.forEach(device => {
                    const d = tuyaDevices.find(({ id }) => device.id === id)
                    if (d === undefined) {
                        const ip = deviceIps[device.id]
                        if (ip) {
                            console.log('Adding new device:', device.name, deviceIps[device.id])
                            promises.push(db.upsertDevice({
                                type: 'outlet', name: [device.name], image: ['outlet'],
                                ip: deviceIps[device.id], key: device.key, id: device.id
                            }, false))
                            restart = true
                        } else {
                            console.log('Unable to find IP:', device.name)
                        }
                    } else if (d.key !== device.key) {
                        console.log('Update device key')
                        promises.push(db.updateDevice(device.id, device.key))
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
    console.log(await getUserDataTest('adamvincent'))

    tuyaDevices = await db.getDevices(false)
    customDevices = await db.getDevices(true)
    automations = await db.getAutomations()

    customDevices.forEach(d => {
        d.name = d.name[0]
        d.image = d.image[0]
        d.state = false
    })

    new Automation(automations)
    new Device(tuyaDevices)

    appleHome.addAccessories(Device.devices.map(device => device.info))
    appleHome.addAccessories(customDevices)
    appleHome.onCommand = (info) => {
        if (info.type === 'garage' && garage.readyState === WebSocket.OPEN) {
            garage.send(JSON.stringify(info))
        } else if (info.type === 'button') {
            console.log(info)
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
        }
    })

    const port = process.env.PORT || 8080
    server.listen(port, () => {
        console.log(`Server listening at http://192.168.2.90:${port}`)
    })
    startHerokuConnection()
}
